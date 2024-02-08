import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { markdownTable } from "markdown-table";
import Term from "./Term";
import SizeLimit from "./SizeLimit";

type GitHub = ReturnType<typeof getOctokit>;

const SIZE_LIMIT_HEADING = `## size-limit report 📦 `;

async function fetchPreviousComment(
  octokit: GitHub,
  repo: { owner: string; repo: string },
  pr: { number: number },
) {
  // TODO: replace with octokit.issues.listComments when upgraded to v17
  const commentList = await octokit.rest.issues.listComments({
    ...repo,
    // eslint-disable-next-line camelcase
    issue_number: pr.number,
  });

  const sizeLimitComment = commentList.data.find((comment) =>
    comment.body?.startsWith(SIZE_LIMIT_HEADING),
  );
  return !sizeLimitComment ? null : sizeLimitComment;
}

async function run() {
  try {
    const { payload, repo } = context;
    const pr = payload.pull_request;

    if (!pr) {
      throw new Error(
        "No PR found. Only pull_request workflows are supported.",
      );
    }

    const token = getInput("github_token");
    const skipStep = getInput("skip_step");
    const buildScript = getInput("build_script");
    const cleanScript = getInput("clean_script");
    const script = getInput("script");
    const packageManager = getInput("package_manager");
    const directory = getInput("directory") || process.cwd();
    const windowsVerbatimArguments =
      getInput("windows_verbatim_arguments") === "true";
    const sizeMargin = getInput("size_margin");
    const octokit = getOctokit(token);
    const term = new Term();
    const limit = new SizeLimit();

    const { status, output } = await term.execSizeLimit(
      undefined,
      skipStep,
      buildScript,
      cleanScript,
      windowsVerbatimArguments,
      directory,
      script,
      packageManager,
    );
    const { output: baseOutput } = await term.execSizeLimit(
      pr.base.ref,
      undefined,
      buildScript,
      cleanScript,
      windowsVerbatimArguments,
      directory,
      script,
      packageManager,
    );

    let base;
    let current;

    try {
      base = limit.parseResults(baseOutput);
      current = limit.parseResults(output);
    } catch (error) {
      console.log(
        "Error parsing size-limit output. The output should be a json.",
      );
      throw error;
    }

    const body = [
      SIZE_LIMIT_HEADING,
      markdownTable(
        limit.formatResults(base, current, {
          sizeMargin: sizeMargin ? limit.parseMargin(sizeMargin) : undefined,
        }),
      ),
    ].join("\r\n");

    const sizeLimitComment = await fetchPreviousComment(octokit, repo, pr);

    if (!sizeLimitComment) {
      try {
        await octokit.rest.issues.createComment({
          ...repo,
          // eslint-disable-next-line camelcase
          issue_number: pr.number,
          body,
        });
      } catch (error) {
        console.log(
          "Error creating comment. This can happen for PR's originating from a fork without write permissions. Logging to console instead:",
        );
        console.log(body);
      }
    } else {
      try {
        await octokit.rest.issues.updateComment({
          ...repo,
          // eslint-disable-next-line camelcase
          comment_id: sizeLimitComment.id,
          body,
        });
      } catch (error) {
        console.log(
          "Error updating comment. This can happen for PR's originating from a fork without write permissions. Logging to console instead:",
        );
        console.log(body);
      }
    }

    if (status > 0) {
      setFailed("Size limit has been exceeded.");
    }
  } catch (error) {
    setFailed(error instanceof Error ? error.message : `${error}`);
  }
}

run();

const core = require("@actions/core");
const Jira = require("./jira");
const Github = require("./github");

class App {
  constructor() {
    this.targetStatus = core.getInput("target-status");
    if (!this.targetStatus) {
      throw new Error("Missing target status input");
    }

    this.jira = new Jira();
    this.github = new Github();
  }

  async run() {
    const issueList = await this.github.extractJiraKeys();
    if (issueList.length === 0) {
      console.log(`No issues found`);
      return;
    }

    console.log(`Found issue keys: ${issueList.join(", ")}`);
    const transitionIds = await this.getTransitionIds(issueList);
    const filteredTransitionIds = transitionIds.filter(Boolean);
    await this.transitionIssues(issueList, filteredTransitionIds);
  }

  async getTransitionIds(issues) {
    const transitionIds = await Promise.all(
      issues.map(async (issue) => {
        try {
          const { transitions } = await this.jira.getIssueTransitions(issue);
          const targetTransition = transitions.find(({ name }) => name === this.targetStatus);
          if (!targetTransition) {
            console.log(`Cannot find transition to status "${this.targetStatus}"`);
            return null;
          }
          return targetTransition.id;
        } catch (error) {
          console.log(`Failed to get transitions for issue ${issue}: ${error.message}`);
          return null;
        }
      })
    );

    return transitionIds.filter(Boolean);
  }

  async transitionIssues(issueList, transitionsIds) {
    for (let i = 0; i < issueList.length; i++) {
      const issueKey = issueList[i];
      const transitionId = transitionsIds[i];
      try {
        await this.jira.transitionIssue(issueKey, transitionId);
      } catch (error) {
        console.log(`Failed to transition issue ${issueKey}: ${error.message}`);
      }
    }
  }
}

module.exports = App;

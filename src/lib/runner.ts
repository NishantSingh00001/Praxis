// Runs an agent's steps one at a time, surfacing each as it goes — the "thinking"
// you see in the UI. Each step does real work and returns a short detail line.

export interface StepDef {
  title: string;
  tool?: string;
  fn: () => Promise<string> | string;
}

export type StepState = "pending" | "running" | "done" | "error";

export interface StepView {
  title: string;
  tool?: string;
  state: StepState;
  detail?: string;
}

export async function runSteps(
  steps: StepDef[],
  onUpdate: (views: StepView[]) => void,
): Promise<void> {
  const views: StepView[] = steps.map((s) => ({ title: s.title, tool: s.tool, state: "pending" }));
  onUpdate([...views]);
  for (let i = 0; i < steps.length; i++) {
    views[i].state = "running";
    onUpdate([...views]);
    await delay(260);
    try {
      views[i].detail = await steps[i].fn();
      views[i].state = "done";
    } catch (e) {
      views[i].detail = (e as Error).message;
      views[i].state = "error";
      onUpdate([...views]);
      return;
    }
    onUpdate([...views]);
    await delay(180);
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

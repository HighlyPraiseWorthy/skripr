// Token meter: wraps Anthropic.messages.create to tally usage by model (pilot cost measurement only).
import { Anthropic } from "@anthropic-ai/sdk";
const tally: Record<string, { in: number; out: number; calls: number }> = {};
const proto: any = (Anthropic as any).Messages?.prototype || Object.getPrototypeOf(new Anthropic({ apiKey: "x" }).messages);
const orig = proto.create;
proto.create = function (body: any, ...rest: any[]) {
  const p = orig.call(this, body, ...rest);
  Promise.resolve(p).then((m: any) => { const t = (tally[body.model] ||= { in: 0, out: 0, calls: 0 }); t.in += m?.usage?.input_tokens || 0; t.out += m?.usage?.output_tokens || 0; t.calls++; }).catch(() => {});
  return p;
};
process.on("exit", () => console.log("TOKENS", JSON.stringify(tally)));

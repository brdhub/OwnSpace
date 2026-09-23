import type { JobCategory } from "./constants";

const rules: Array<[JobCategory, RegExp]> = [
  ["backend", /后端|服务端|后台开发|\bback[ -]?end\b|\bjava\b|\bgolang\b|\bgo开发|\bnode\.?js\b/i],
  ["frontend", /前端|\bfront[ -]?end\b|\breact\b|\bvue\b/i],
  ["fullstack", /全栈|\bfull[ -]?stack\b/i],
  ["ai_application", /\bagent\b|智能体|AI\s*应用|大模型应用|\brag\b/i],
  ["algorithm", /算法|机器学习|深度学习|\balgorithm\b|\bmachine learning\b|\bnlp\b/i],
  ["testing", /测试|测开|\bqa\b|\bsdet\b|\btest(?:ing)?\b/i],
  ["operations", /运维|\bsre\b|\bdevops\b/i],
  ["client", /客户端|安卓|鸿蒙|\bandroid\b|\bios\b|\bflutter\b/i],
  ["embedded", /嵌入式|单片机|固件|\bembedded\b|\bfirmware\b/i],
  ["product", /产品经理|产品助理|产品策划|\bproduct manager\b/i],
];

// Multiple directions or vague titles require a manual choice.
export function matchJobCategory(title: string): JobCategory | null {
  const matches = rules.filter(([, pattern]) => pattern.test(title.normalize("NFKC")));
  return matches.length === 1 ? matches[0][0] : null;
}

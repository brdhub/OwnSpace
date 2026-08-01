export const studyCategories = ["coding", "java-foundation", "project-understanding", "other-learning"] as const;

export type StudyCategory = (typeof studyCategories)[number];

export const studyCategoryMeta: Record<
  StudyCategory,
  {
    name: string;
    description: string;
    quantityLabel: string;
    resource?: { name: string; url: string };
    prompts?: string[];
  }
> = {
  coding: {
    name: "代码能力",
    description: "刷题、复盘思路，保持对算法与编码的熟悉度。",
    quantityLabel: "完成题数",
    resource: { name: "LeetCode 热题 Hot 100", url: "https://leetcode.cn/studyplan/top-100-liked/" },
  },
  "java-foundation": {
    name: "Java 基础知识",
    description: "复习 Java、并发、JVM、Spring、数据库与后端核心知识。",
    quantityLabel: "复习主题数",
    resource: { name: "JavaGuide Java 知识体系", url: "https://javaguide.cn/java/" },
  },
  "project-understanding": {
    name: "工程项目理解",
    description: "把做过的项目讲清楚：业务、架构、代码、难点与取舍。",
    quantityLabel: "梳理模块数",
    prompts: ["梳理一个业务流程", "阅读一个核心模块", "追踪一次请求链路", "补写一个项目亮点", "复盘一个技术决策", "准备一个项目面试问题"],
  },
  "other-learning": {
    name: "其他知识摄入",
    description: "记录任何有助于求职和成长的知识输入，不必局限于固定方向。",
    quantityLabel: "学习条目数",
  },
};
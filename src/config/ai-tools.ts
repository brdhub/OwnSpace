export const aiToolGroups = [
  {
    title: "通用对话",
    tools: [
      { name: "ChatGPT", url: "https://chatgpt.com", description: "通用问答、写作、代码与学习讨论。" },
      { name: "Claude", url: "https://claude.ai", description: "长文本阅读、写作和代码辅助。" },
      { name: "Gemini", url: "https://gemini.google.com", description: "Google 的多模态对话助手。" },
      { name: "Microsoft Copilot", url: "https://copilot.microsoft.com", description: "搜索、问答和办公辅助入口。" },
    ],
  },
  {
    title: "国内常用",
    tools: [
      { name: "通义千问", url: "https://tongyi.aliyun.com/qianwen/", description: "中文问答、写作和代码辅助。" },
      { name: "文心一言", url: "https://yiyan.baidu.com", description: "百度的中文对话 AI 入口。" },
      { name: "Kimi", url: "https://kimi.moonshot.cn", description: "长文档阅读和中文对话。" },
      { name: "豆包", url: "https://www.doubao.com", description: "日常对话、写作和学习辅助。" },
      { name: "DeepSeek", url: "https://chat.deepseek.com", description: "推理、代码和中文问答。" },
      { name: "讯飞星火", url: "https://xinghuo.xfyun.cn", description: "中文对话、写作和办公辅助。" },
    ],
  },
  {
    title: "代码与开发",
    tools: [
      { name: "GitHub Copilot", url: "https://github.com/features/copilot", description: "代码补全、解释和开发辅助。" },
      { name: "Perplexity", url: "https://www.perplexity.ai", description: "带来源的搜索式问答。" },
    ],
  },
] as const;
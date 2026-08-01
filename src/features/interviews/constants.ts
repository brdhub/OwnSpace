export const interviewRounds = ["hr", "firstTechnical", "secondTechnical", "final", "other"] as const;
export const interviewResults = ["pending", "passed", "rejected", "cancelled", "unknown"] as const;
export const interviewTagCategories = [
  "backend",
  "database",
  "middleware",
  "concurrency",
  "distributed",
  "fundamentals",
  "frontend",
  "ai-agent",
  "other",
] as const;

export type InterviewRound = (typeof interviewRounds)[number];
export type InterviewResult = (typeof interviewResults)[number];
export type InterviewTagCategory = (typeof interviewTagCategories)[number];

export const interviewRoundMeta: Record<InterviewRound, string> = {
  hr: "HR 面",
  firstTechnical: "技术一面",
  secondTechnical: "技术二面",
  final: "终面",
  other: "其他",
};

export const interviewResultMeta: Record<InterviewResult, string> = {
  pending: "等待结果",
  passed: "通过",
  rejected: "未通过",
  cancelled: "已取消",
  unknown: "未知",
};

export const interviewTagCategoryMeta: Record<InterviewTagCategory, string> = {
  backend: "后端与 Java",
  database: "数据库",
  middleware: "中间件与缓存",
  concurrency: "高并发",
  distributed: "分布式",
  fundamentals: "计算机基础",
  frontend: "前端",
  "ai-agent": "AI Agent",
  other: "其他",
};

export const predefinedInterviewTags = [
  ["java", "Java", "backend"],
  ["jvm", "JVM", "backend"],
  ["spring", "Spring", "backend"],
  ["spring-boot", "Spring Boot", "backend"],
  ["spring-mvc", "Spring MVC", "backend"],
  ["mybatis", "MyBatis", "backend"],
  ["aop", "AOP", "backend"],
  ["transaction", "事务", "backend"],
  ["design-patterns", "设计模式", "backend"],
  ["mysql", "MySQL", "database"],
  ["sql", "SQL", "database"],
  ["index", "索引", "database"],
  ["sql-optimization", "SQL 优化", "database"],
  ["mvcc", "MVCC", "database"],
  ["locks", "锁机制", "database"],
  ["database-transaction", "数据库事务", "database"],
  ["redis", "Redis", "middleware"],
  ["cache", "缓存", "middleware"],
  ["cache-penetration", "缓存穿透", "middleware"],
  ["cache-breakdown", "缓存击穿", "middleware"],
  ["cache-avalanche", "缓存雪崩", "middleware"],
  ["message-queue", "消息队列", "middleware"],
  ["kafka", "Kafka", "middleware"],
  ["rabbitmq", "RabbitMQ", "middleware"],
  ["high-concurrency", "高并发", "concurrency"],
  ["thread-pool", "线程池", "concurrency"],
  ["concurrent-programming", "并发编程", "concurrency"],
  ["rate-limiting", "限流", "concurrency"],
  ["distributed-lock", "分布式锁", "distributed"],
  ["microservices", "微服务", "distributed"],
  ["distributed-system", "分布式系统", "distributed"],
  ["consistency", "一致性", "distributed"],
  ["operating-system", "操作系统", "fundamentals"],
  ["computer-network", "计算机网络", "fundamentals"],
  ["http", "HTTP", "fundamentals"],
  ["https", "HTTPS", "fundamentals"],
  ["tcp", "TCP", "fundamentals"],
  ["linux", "Linux", "fundamentals"],
  ["algorithm-data-structure", "算法与数据结构", "fundamentals"],
  ["typescript", "TypeScript", "frontend"],
  ["react", "React", "frontend"],
  ["nodejs", "Node.js", "frontend"],
  ["llm", "大语言模型", "ai-agent"],
  ["rag", "RAG", "ai-agent"],
  ["mcp", "MCP", "ai-agent"],
  ["ai-agent", "AI Agent", "ai-agent"],
] as const satisfies ReadonlyArray<readonly [string, string, InterviewTagCategory]>;

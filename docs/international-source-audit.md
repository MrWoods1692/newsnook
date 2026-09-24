# 国际新闻源审计（2026-09-24）

目标：把“国际中文”和“国际英文”按**正文可直接阅读的语言**拆开，同时把“综合新闻”和“评论 / 智库”拆开。`NewsSource.group === 'intl'` 继续只承担国际源网络分流，不再拿它表达语言。

## 国际中文

| 媒体 | 探测结果 | Newsnook 接入决策 |
|---|---|---|
| BBC 中文 | 第一方 RSS：`https://feeds.bbci.co.uk/zhongwen/trad/rss.xml`；当前为繁体 | `feed`；保留 `bbc-zh`。删除与它完全同源的 `bbc-zh-china` / `bbc-zh-world` 别名 |
| 纽约时报中文网 | 第一方 RSS：`https://cn.nytimes.com/rss/`，实测 200 且持续更新 | `feed`：`nytimes-zh` |
| 华尔街日报中文网 | 站点仍存在，但当前直接请求返回访问控制；旧中文 RSS 地址不可用，未发现稳定第一方公开 RSS | 不使用第三方镜像；暂不内置。若以后接入，应做浏览器会话 / 授权感知的自定义源，并尊重订阅墙 |
| RFI 中文 | 第一方 RSS：`https://www.rfi.fr/cn/rss`，实测 200 / `application/rss+xml` | `feed`：`rfi-zh` |
| 联合早报 | `/rss`、`/rss.xml` 均不可用；`/news/world` 公开 HTML 可稳定获取文章卡片 | 第一方自定义 HTML：`zaobao` kind，源 `zaobao-world`；不依赖 RSSHub / FeedX |
| DW 中文 | 第一方 RDF RSS：`https://rss.dw.com/rdf/rss-chi-all`，实测持续更新 | `feed`；修正原 `dw-top` 误接英文 `rss-en-top` 的问题 |
| FT中文网 | 第一方 RSS：`https://www.ftchinese.com/rss/feed`，实测 200 / `application/rss+xml` | `feed`：`ftchinese` |
| 彭博商业周刊中文版 | `bbwc.cn` 仍在运营；未发现稳定公开第一方 RSS，当前运行环境对部分路径还有 TLS/站点访问异常 | 暂不内置第三方 feed。后续仅在找到稳定第一方列表接口后做自定义解析 |
| 日经中文网 | `cn.nikkei.com` 当前对自动请求返回 403；未发现可直接使用的中文第一方 RSS | 暂不内置；若做需自定义浏览器/站点适配。英文 Nikkei Asia 可直接 RSS |
| 路透中文网 | `cn.reuters.com` 已不再提供独立中文站，当前会转向 Reuters 全球站；旧中文 RSS 不可用 | 不创建“路透中文”伪源，也不接第三方镜像 |
| 南华早报（SCMP） | 有官方 RSS，但当前公开站是英文；“China”是报道栏目，不是中文版本 | 归“国际英文”；保留 `scmp-china` / `scmp-news`，名称避免暗示中文 |
| 今日俄罗斯中文 / RT 中文 | 未发现与 RT.com 对应、可稳定验证的公开中文 RSS；“俄罗斯卫星通讯社中文”是另一个产品/站点，不应自动等同 | 暂不误配。若产品要的是 Sputnik 中文，应单独立项探测其当前站点/API |
| 美国之音中文网 | 官方 RSS 订阅页仍提供中文“新闻”聚合源，实测 XML 200 | `feed`：`voa-zh` |
| 中央社 · 国际 | 官方 RSS 服务明确列出“国际”FeedBurner 源，实测 XML 200 | `feed`：`cna-intl-zh` |

## 国际英文

综合新闻栏只放新闻源，不再混入评论/智库：

- 第一方 RSS：BBC World、DW English、NYT World、WSJ World News、Nikkei Asia、Channel NewsAsia World、SCMP、NPR、Guardian World、France 24、Al Jazeera。
- Google News World 保留为聚合补充，但不是核心第一方媒体。
- Foreign Affairs、New York Review of Books、Bloomberg Opinion、Project Syndicate、Sinocism 移到独立“国际英文·深读”。

## 结构约束

1. 保留分类 ID `intl` / `intl-world`，只改显示语义为“国际中文” / “国际英文”，避免破坏已有用户布局。
2. 新增 `intl-depth-world` 承担英文评论/智库。
3. `group: 'intl'` 继续用于网络代理策略；语言由分类决定，禁止再把 `group` 当 locale。
4. 同一真实 Feed 不允许用多个 source ID 伪装成不同栏目。
5. 优先第一方 RSS/Atom；没有第一方 feed 时才做站点自定义解析；不把 RSSHub/FeedX 等第三方镜像设为内置默认依赖。

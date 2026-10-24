# whalestory
将 DeepSeek Harness 的运行状态变成肥鱼讲故事。在聊天输入框上方显示大肥鱼，根据当前会话的工具调用、流式思维链/回答、错误和待回答状态切换图片并说一句短台词。

## 安装
在插件管理页面添加 
```
@gordon2moon/dsh-whalestory
```
- 安装后将当前 GUI 页面刷新一次；插件会跨会话、跨重启保留，可在插件页停用。

## 特点
- 台词的本地台词库总是立即生成；符合节拍且冷却已过时，才低频请求一次独立旁白模型。LLM 调用不携带 SessionId、不共享主会话上下文、不使用工具，主会话的消息历史和请求前缀不受影响。
- 节省策略：客户端 45 秒冷却；服务端每会话 45 秒、每 10 分钟最多 20 次、全局每小时最多 30 次、全局并发 1、6 秒超时、最多 96 输出 token，并优先关闭 reasoning。
- 图片显示严格按 `img/picture_ref.md`：普通、错误、询问、写作、双帧行走，以及叠加在角色右上方的气泡。
- 高提问/审批面板会替换整个输入框区域；此时角色切到右上角的小号“探头”模式，避免被高面板挤出视野，回答完自动回到输入框上方。
- 美术原图保留在 `img/`；`plugin/assets/` 中是从原图派生的透明 WebP，可由 `scripts/build-whalestory-assets.sh` 重新生成。
- 人设写作规范在 `.dsh/skills/da-feiyu/SKILL.md`，原始人设与语料仍在 `references/`。

### 验证

```bash
node --test plugin/test/client.test.mjs plugin/test/narrate.test.mjs
node --check plugin/index.js
node --check plugin/narrate.js
node --check plugin/client.js
```
### 版权信息
制作图片时使用了 https://github.com/TreapGoGo/deepseek-whale-girl 中的提示词，本项目中图片也使用CC BY-SA 4.0
人设语料来自 https://github.com/ERUIHNIYHBKBNF/dafeiyu-persona/ ，使用MIT协议。
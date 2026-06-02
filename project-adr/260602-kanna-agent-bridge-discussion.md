# Ghi chú thảo luận: Kanna, agent bridge, Antigravity, Pi, skills, MCP, workflow

Ngày ghi: 2026-06-02

## Mục đích

Ghi lại toàn bộ mạch thảo luận chính về Kanna: Kanna nên là gì, dùng các agent như Claude/Codex/Antigravity/Pi ra sao, permission bridge phải hoạt động thế nào, và các lỗi thực tế đã gặp khi test Antigravity/Claude trong UI.

ADR liên quan: `260602-adr-05.md`.

## Câu hỏi ban đầu

Các câu hỏi chính:

- Kanna có phải chỉ là proxy của các agent không?
- Người dùng có thể chọn Claude, Codex, Antigravity, Pi tùy ý không?
- Các agent khác nhau ở khả năng nào?
- Kanna làm sao khử sai lệch kỹ thuật khi gọi từng agent?
- Skill và MCP nên gắn vào Kanna hay gắn trực tiếp vào từng agent?
- Workflow nên đặt ở đâu nếu không phải agent nào cũng có khái niệm workflow?
- Kanna có hỗ trợ LLM thuần không?
- Kanna có nên là một agent riêng và có CLI riêng không?
- Có cần cấu hình Pi riêng không, hay chỉ tương tác với Kanna là đủ?
- Nếu Pi có extension mới thì Kanna có tự tận dụng được không?
- Có thể trang bị tool cho Kanna CLI để dẹp hết agent ngoài và chỉ còn agent Kanna không?
- Làm sao biết agent đang chạy, bị kẹt, hay đang chờ permission?

## Bối cảnh thay đổi hướng

Ý tưởng ban đầu:

```text
Pi Agent làm backend
Kanna làm UI
```

Sau khi triển khai và test, hướng này đã mở rộng thành:

```text
Kanna UI
  -> Kanna runtime/coordinator
  -> provider adapters
  -> Claude / Codex / Antigravity / Pi / pure LLM
```

Tức là Kanna không nên chỉ bọc Pi. Kanna nên là control plane/runtime chung, còn Pi, Claude, Codex, Antigravity là các provider có adapter riêng.

## Điều đã chốt: vai trò của Kanna

Kanna không chỉ là proxy mỏng.

Kanna phải sở hữu:

- UI
- transcript chuẩn hóa
- workflow state
- artifact state
- approval/permission model
- MCP/skill declaration
- provider capability registry
- runtime/coordinator
- hướng tới Kanna CLI

Các agent/provider sở hữu:

- model behavior riêng
- tool native riêng
- plugin/extension native riêng
- session/resume native riêng
- permission prompt native riêng

Adapter làm nhiệm vụ dịch:

```text
provider-specific behavior -> Kanna normalized events/tools/status
```

## Khác biệt giữa các agent

Không nên xem Claude, Codex, Antigravity, Pi là giống nhau.

Chúng khác nhau ở:

- model và cách reasoning
- có/không có tool file native
- có/không có shell native
- định dạng stream output
- có JSONL/structured events hay chỉ text
- có permission prompt hay không
- có MCP native hay không
- có skill/plugin native hay không
- có workflow native hay không
- session/resume khác nhau
- mức độ ổn định của CLI/API khác nhau

Vì vậy Kanna cần capability contract cho từng provider, ví dụ:

```text
provider có streaming không?
provider có structured event không?
provider có file tool không?
provider có shell tool không?
provider có permission prompt không?
provider có MCP không?
provider có skill không?
workflow là native hay do Kanna quản?
provider có resume không?
```

## Khử sai lệch kỹ thuật

Kanna khử sai lệch bằng adapter layer.

Adapter chịu trách nhiệm:

- gọi đúng CLI/API
- parse stdout/stderr
- nhận diện stream text
- nhận diện tool call
- nhận diện permission request
- map session/resume
- phát hiện timeout/error
- normalize về transcript/tool/status của Kanna

Không để UI phải biết `agy`, `pi`, `claude`, `codex` mỗi cái phát event kiểu gì.

## Skill và MCP

Đã chốt:

```text
Skill/MCP khai báo ở Kanna trước.
Kanna map sang provider nếu provider hỗ trợ.
Nếu provider không hỗ trợ, Kanna dùng runtime/tool của chính Kanna.
Nếu chưa hỗ trợ được, UI phải nói rõ unsupported.
```

Người dùng nên thêm skill/MCP ở Kanna, không phải đi cấu hình thủ công nhiều nơi.

Tuy nhiên provider vẫn có phần bắt buộc riêng:

- cài CLI
- login/API key
- native plugin nếu Kanna chưa cài/map được
- global settings provider không expose cho Kanna

## Pi config và Pi extension

Câu trả lời thực dụng:

Người dùng không nên phải cấu hình Pi cho các hành vi project-level thông thường. Kanna phải là nơi cấu hình chính.

Nhưng Pi vẫn cần native prerequisite:

- Pi CLI đã cài
- Pi đã auth/login
- plugin/extension native đã có nếu Kanna chưa quản lý được

Nếu Pi có extension mới:

- Kanna tự tận dụng được nếu Pi expose manifest/schema/tool list machine-readable.
- Nếu extension chỉ thay đổi hành vi CLI dạng human text, Kanna có thể phải sửa adapter.

Điều này cũng áp dụng cho Antigravity plugin.

## Workflow

Đã chốt:

```text
Workflow thuộc về Kanna.
Agent chỉ là executor trong từng bước.
```

Lý do: không phải agent nào cũng có workflow native. Nếu để workflow thuộc về provider, Kanna sẽ bị khóa vào một agent cụ thể.

Kanna workflow gồm:

- workflow catalog
- project workflow registry
- workflow run
- artifact state
- source of truth review
- downstream review/repair
- event log
- projection UI

Nếu provider có workflow native, Kanna có thể gọi nó, nhưng state canonical vẫn phải ghi ở Kanna.

## LLM thuần và Kanna agent

Kanna có thể hỗ trợ LLM thuần trong tương lai.

Nhưng LLM thuần không đồng nghĩa với agent. Nếu muốn bỏ hết external agent, Kanna phải tự có runtime:

- file read/write
- shell execution
- patch/apply diff
- sandbox/permission
- MCP tools
- skill runtime
- context packing
- streaming tool call
- session memory
- workflow execution

Kanna CLI cũng nên có, nhưng không nên chỉ là chat CLI. Kanna CLI nên là control surface của runtime:

- start/resume chat
- chọn provider
- xem status provider
- approve/deny permission
- chạy workflow
- xem artifact/transcript
- chạy Kanna-native tool khi ở pure LLM mode

## Permission bridge cho agy và pi

Đây là điểm chốt rất quan trọng.

Trước đó Antigravity bị kẹt vì permission prompt hiện trong terminal/child process nhưng UI không thấy. Bridge đúng phải là:

```text
agent CLI hỏi permission
-> Kanna parse request
-> Kanna tạo cli_permission_request
-> UI hiện approve/deny
-> user chọn
-> Kanna ghi lựa chọn vào stdin của process
-> agent tiếp tục hoặc dừng
```

Áp dụng cho cả `agy` và `pi`.

Prompt Antigravity đã thấy:

```text
Requesting permission for: openspec list

Do you want to proceed?
> 1. Yes
  2. Yes, and always allow in this conversation for commands that start with 'openspec'
  3. Yes, and always allow for commands that start with 'openspec' (Persist to settings.json)
  4. No
```

Kanna phải biến prompt này thành tool/message chuẩn trong transcript, không để user phải nhìn terminal.

## Làm sao biết agent có chạy không?

UI cần phân biệt:

- connected: Kanna server còn nối WebSocket
- session started: chat session đã bắt đầu
- provider process spawned: process agent đã được spawn
- streaming: agent đang có output
- waiting for permission: đang chờ approve/deny
- waiting for user input: agent đang chờ input khác
- no output timeout: chạy nhưng chưa có output quá lâu
- errored: process lỗi
- interrupted: user stop
- completed: xong

Vấn đề đã gặp: UI chỉ hiện `Running...` quá lâu, trong khi Antigravity thực tế bị kẹt hoặc adapter gọi sai CLI.

## Antigravity findings

Claude chạy được.

Antigravity không chạy trong Kanna vì adapter ban đầu giả định sai.

Local `agy --help` cho thấy:

```text
agy --print "hello"
```

chạy được.

Các option local đáng chú ý:

```text
--print
--print-timeout
--prompt-interactive
--continue
--conversation
--dangerously-skip-permissions
```

Adapter cũ từng gọi sai:

```text
agy run --model gemini-3.5-flash --output-format jsonl --non-interactive ...
```

Nhưng local `agy` không có `run` subcommand như vậy.

Sau đó adapter chuyển sang `agy --print` nhưng lại đưa prompt qua stdin. Local CLI cần prompt là argument, nên vẫn có thể treo.

Hướng đúng hiện tại:

```text
agy --print --print-timeout 5m "<prompt>"
```

Nếu resume:

```text
agy --print --print-timeout 5m --conversation <conversation-id> "<prompt>"
```

Model/effort trong UI không nên pass bừa vào `agy` nếu CLI không hỗ trợ flag đó.

## Antigravity SDK

Có SDK chính thức:

```text
google-antigravity/antigravity-sdk-python
```

Hướng dài hạn: cân nhắc SDK adapter để có event/permission/session structured hơn thay vì parse text CLI.

Chốt hiện tại:

```text
CLI adapter là đường chạy ngay.
SDK adapter là hướng tốt hơn để nghiên cứu sau.
```

## Pi findings

Pi cũng phải đi qua cùng bridge.

Không được giả định Pi giống Codex JSONL.

Hướng adapter hiện tại:

```text
pi --mode json --print --no-session --model <model> [--thinking <effort>] [--session-id <id>] "<prompt>"
```

Cần verify với Pi CLI local. Nếu Pi help/docs khác, adapter phải theo Pi thực tế.

## Lỗi gửi hai tin

Lỗi đã thấy:

Gõ `xin chào`, nhấn gửi, UI tạo hai tin.

Chốt:

Chat input cần double-submit guard:

- có `submitInFlightRef`
- nếu đang gửi thì bỏ qua submit mới
- reset khi gửi xong hoặc fail

## Những gì đã triển khai trong code

Đã triển khai theo hướng thảo luận:

- thêm `cli_permission_request` tool kind
- thêm type/hydration/normalization cho CLI permission request
- server giữ pending tool request và nhận response approve/deny
- Antigravity/Pi manager nhận `onToolRequest`
- UI có component hiển thị permission request
- approve/deny gửi ngược qua `chat.respondTool`
- ChatInput có guard chống gửi trùng
- Antigravity adapter chuyển sang spawn per turn bằng `agy --print --print-timeout 5m "<prompt>"`
- Pi adapter chuyển sang spawn per turn theo print-mode
- Antigravity raw text được đưa thành assistant output nếu không có JSON structured result

Đã verify:

```text
pnpm --filter @kanna/server check
pnpm --filter @kanna/client build
```

đều pass.

## Lưu ý vận hành

Sau khi sửa adapter server, phải restart dev server.

Nếu còn process cũ, nên dọn:

```text
pkill -f "agy --print"
pkill -f "agy run"
bun run dev
```

Nếu UI vẫn `Running...`, kiểm tra:

- backend đã restart chưa
- có process `agy` cũ đang kẹt không
- command spawn thực tế là gì
- stdout/stderr có output không
- permission prompt có bị chờ không
- WebSocket còn connected không

## Kết luận đã chốt

Kanna nên đi theo hướng:

```text
Kanna là runtime/control plane cho nhiều agent.
Provider adapter là phần lõi, không phải phụ.
Workflow và permission thuộc về Kanna.
Skills/MCP khai báo ở Kanna rồi map xuống provider nếu được.
Pi/Antigravity/Claude/Codex là executor/provider, không phải chủ sở hữu workflow.
Pure LLM và Kanna CLI là hướng dài hạn, nhưng cần runtime tool đầy đủ mới thay thế được agent ngoài.
```


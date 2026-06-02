Mục tiêu tối thượng là: **Hệ thống (cả UI và MCP) chạy chính xác theo kiến trúc CQRS/Event Sourcing đã vạch ra trong ADR, và UI tuân thủ Design System Kanna.**

Tài liệu này là checklist triển khai thực tế, không phải trạng thái “đã xong” mang tính dự đoán.

---

### Giai đoạn 1: Right Sidebar dùng projection thật [3/3]

**Mục tiêu:** Right sidebar hiển thị workflow state từ runtime store thay vì chỉ demo data.

- [x] Right sidebar subscribe `project-workflow` projection qua server WebSocket.
- [x] Server reconstruct projection từ `workflow_runs`, `workflow_nodes`, `workflow_events`, `artifacts`, `artifact_impacts`.
- [x] UI dùng wording trung thực: `done`, `running`, `known`, `horizon`, không hiển thị tổng số step toàn workflow khi chưa thể biết trước.

### Giai đoạn 2: Downstream Review/Repair & Artifact State [3/3]

**Mục tiêu:** Action artifact không chỉ gửi prompt cho agent, mà còn ghi state/audit vào event-store.

- [x] `Review downstream`, `Repair downstream`, `Invalidate`, `Accept as source of truth` ghi qua WebSocket command.
- [x] Server append event audit tương ứng vào `workflow_events`.
- [x] Khi có source/impacted artifact thật, server cập nhật `artifact_impacts`; projection đọc cả persisted impacts và estimated event impacts.

### Giai đoạn 3: Workflow Import/Pubish Pipeline [3/3]

**Mục tiêu:** Workflow import/publish đi vào DB immutable version, không chỉ ghi file local.

- [x] Schema `WorkflowManifest` nằm trong `packages/shared`.
- [x] `packages/workflow-extractor` parse markdown/workflow thành manifest để human review.
- [x] Publish từ UI/MCP ghi vào `workflow_definitions` + `workflow_versions`, và start-run generic dựng node/artifact từ manifest nếu không phải seed curriculum workflow.

### Giai đoạn 4: MCP MVP parity [3/3]

**Mục tiêu:** Agent bên ngoài có thể thao tác workflow platform qua MCP với cùng semantics cốt lõi như UI.

- [x] List/start/get projection/list runs/list events/list artifacts.
- [x] Publish workflow manifest.
- [x] Mark artifact và update artifact impact.

### Ghi chú audit 2026-06-01

Các điểm đã sửa sau audit:

- Publish workflow trước đó chỉ ghi `workflow-manifest.json`; hiện đã publish vào DB/event-store path.
- `startRun` trước đó hard-code seed curriculum; hiện dùng manifest generic cho workflow import.
- Artifact action trước đó chủ yếu gửi prompt; hiện ghi state/event trước rồi chat/agent tiếp tục xử lý.
- Supabase env loader trước đó chỉ đọc `.env.local` từ cwd; hiện tìm ngược lên parent để dev server chạy từ `packages/server` vẫn đọc được root `.env.local`.
- MCP trước đó thiếu publish/mark/update impact; hiện đã có tool parity cho MVP.

### Ghi chú hiệu chỉnh 2026-06-02

Các điểm đã sửa sau khi rà lại MVP:

- `WorkflowManifest` đã có `nodes` để biểu diễn workflow/task/step/sub-workflow lồng nhau, không chỉ còn danh sách artifact phẳng.
- Workflow extractor sinh root workflow node, artifact check nodes, và sub-workflow horizon nodes khi phát hiện `run workflow`.
- Runtime generic start-run dựng node tree từ `manifest.nodes`; nếu manifest cũ chưa có nodes thì vẫn fallback sang artifact check nodes.
- Artifact rows có trạng thái rõ hơn qua metadata: `pending`, `done`, `invalidated`, `source_of_truth`.
- Right sidebar đổi `Latest Artifacts` thành `Workflow Artifacts`, hiển thị status/checklist và đủ action `View`, `Rerun`, `Review`, `Repair`, `Regen`, `Invalidate`, `Accept`.

Các giới hạn còn chủ ý của MVP:

- Extractor hiện vẫn là static heuristic, chưa phải AI agent đọc workflow markdown sâu.
- `artifact_impacts` chỉ persist khi cả source và impacted artifact đã tồn tại trong DB; nếu chưa có impacted artifact thật, hệ thống vẫn append audit event để không mất dấu.
- Realtime hiện broadcast lại projection qua app server; chưa tối ưu filter `workflow_events` theo `project_id` vì bảng event không có cột `project_id`.
- `Rerun`/`Regen` hiện tạo invalidation state và prompt agent thực thi; chưa có scheduler/queue độc lập để replay subtree hoàn toàn không cần chat.

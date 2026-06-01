Mục tiêu tối thượng là: **Hệ thống (cả UI và MCP) chạy chính xác theo kiến trúc CQRS/Event Sourcing đã vạch ra trong 2 bản ADR, và UI tuân thủ nghiêm ngặt hệ thống Design System Kanna.**

Dưới đây là kế hoạch 3 giai đoạn. Xin bạn kiểm tra và cho ý kiến trước khi mình bắt tay vào code.

---

### Giai đoạn 1: "Thổi hồn" vào Right Sidebar (Kết nối DB & Realtime)

**Mục tiêu:** Thay thế dữ liệu giả (demo data) trong package `@kanna/workflow-tracker` bằng dữ liệu thật từ bảng Projections của Supabase, và cập nhật theo thời gian thực.

**Chi tiết công việc:**
1. **Thiết lập Supabase Client ở Frontend:**
   * Kiểm tra/Tạo Supabase Context Provider trong app React (`apps/kanna/src`).
   * Viết các hooks (`useWorkflowProjection`, `useArtifacts`) để fetch dữ liệu từ bảng `workflow_nodes` và `artifacts`.
2. **Kích hoạt Realtime Subscriptions:**
   * Lắng nghe các event `INSERT` trên bảng `workflow_events`.
   * Khi có event mới (ví dụ `step_started` hoặc `artifact_produced`), tự động mutate/refetch local state để UI Right Sidebar chạy thanh tiến trình (progress) mà không cần reload.
3. **Chuẩn hóa UI Right Sidebar theo `DESIGN.md`:**
   * Áp dụng **3 Chế độ hiển thị (Density Modes)**: Compact, Normal, Expanded.
   * Cập nhật các thẻ Card, Popover sử dụng đúng màu nền (`bg-card`, `bg-background`), màu viền (`border-border`) và typography (font Body cho text, Roboto Mono cho log/code).
   * Đảm bảo hiển thị số lượng step trung thực theo từ vựng: `done`, `running`, `known next`, `horizon open` (Không dùng x/y step ảo).

### Giai đoạn 2: Cơ chế Downstream Repair & Quản lý Artifact (UI + Logic)

**Mục tiêu:** Hiện thực hóa cơ chế quản lý Artifact thay vì "Rerun" toàn bộ (như mục 3 - ADR 02).

**Chi tiết công việc:**
1. **Mở rộng giao diện Artifact (Expanded Mode):**
   * Code các action buttons: `Rerun`, `Review downstream`, `Repair downstream`, `Regenerate`, `Invalidate`, `Accept as source of truth`.
   * Các nút bấm phải là hình viên thuốc (`rounded-full`) hoặc thẻ tag (`rounded-md` đối với action nhỏ) theo `DESIGN.md`.
2. **Logic tính toán Impact (Phía Server):**
   * Viết logic (hoặc thêm function vào MCP/Store) để tính toán cây phụ thuộc dựa trên `artifact_impacts`. 
   * Khi user bấm "Repair downstream", hệ thống sẽ xác định danh sách các artifact chịu ảnh hưởng (`needs_repair`).
3. **Cảnh báo (Dialog Overlay):**
   * Sử dụng component `DialogOverlay` và `DialogContent` (z-index 50, shadow-xl) để hiện cảnh báo khi user kích hoạt Repair hàng loạt.

### Giai đoạn 3: Workflow Import Pipeline [3/3]

**Mục tiêu:** Cho phép nạp định nghĩa Workflow từ file Markdown một cách bài bản thay vì hard-code.

**Chi tiết công việc:**
- [x] 1. Khai báo Schema (`ArtifactDefinition`, `ArtifactDependencyRule`, `WorkflowManifest`) trong `packages/shared`.
- [x] 2. Viết **Static Extractor Script** (`packages/workflow-extractor`) parse Markdown tìm metadata (ví dụ regex tìm block `<!-- [ARTIFACT] -->`, `derives_from`).
- [x] 3. Tạo Human Approval UI: Làm một bảng hiển thị dạng `DiffFileCard` hoặc `InfoCard` để user review Manifest. Nếu đồng ý thì "Publish" vào DB thành một Immutable Workflow Version.

---
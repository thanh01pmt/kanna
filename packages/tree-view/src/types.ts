export interface TreeNode {
  name: string;
  path: string; // The relative path from the project root
  type: "file" | "directory";
  children?: TreeNode[];
}

import Id from "@/js/model/Id";

interface Workspace extends Id {
  name: string;
  logoUrl: string;
  type: ("PUBLIC" | "HOME" | "SHARED");
}

export default Workspace;

export function mapWorkspace(workspace: any): Workspace {
  return {
    id: workspace.id,
    name: workspace.name,
    logoUrl: workspace.logoUrl,
    type: workspace.type,
  };
}

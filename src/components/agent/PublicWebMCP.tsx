import { draftMode } from "next/headers";
import { WebMCP } from "./WebMCP";

export async function PublicWebMCP() {
  return <WebMCP enabled={!(await draftMode()).isEnabled} />;
}

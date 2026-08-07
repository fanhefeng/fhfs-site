import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../../AdminChrome";
import { PostForm } from "../PostForm";

export default async function NewPost() {
  await requireAdminPage();
  return (
    <AdminChrome title="新文章">
      <PostForm
        isNew
        post={{
          slug: "",
          locale: "zh",
          title: "",
          // Today, as a starting point rather than a claim — it is editable.
          // sv-SE formats as YYYY-MM-DD in the server's local zone; the ISO
          // string would be UTC, i.e. yesterday for a Qingdao morning.
          date: new Intl.DateTimeFormat("sv-SE").format(new Date()),
          summary: "",
          tags: [],
          draft: false,
          bodyMd: "",
        }}
      />
    </AdminChrome>
  );
}

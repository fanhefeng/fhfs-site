import { AdminChrome } from "../../AdminChrome";
import { PostForm } from "../PostForm";

export default function NewPost() {
  return (
    <AdminChrome title="新文章">
      <PostForm
        isNew
        post={{
          slug: "",
          locale: "zh",
          title: "",
          // Today, as a starting point rather than a claim — it is editable.
          date: new Date().toISOString().slice(0, 10),
          summary: "",
          tags: [],
          draft: false,
          bodyMd: "",
        }}
      />
    </AdminChrome>
  );
}

import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../../AdminChrome";
import { SecretForm } from "../SecretForm";

export default async function NewSecret() {
  await requireAdminPage();
  return (
    <AdminChrome
      title="新的秘密"
      section="/admin/secrets"
      view={null}
      blurb="slug 和语言存下之后就不能改了——它们是这条的地址。"
    >
      <SecretForm
        isNew
        secret={{
          slug: "",
          locale: "zh",
          kind: "essay",
          title: "",
          // Today in the server's local zone — a starting point, editable.
          date: new Intl.DateTimeFormat("sv-SE").format(new Date()),
          summary: "",
          audio: "",
          duration: "",
          draft: false,
          bodyMd: "",
        }}
      />
    </AdminChrome>
  );
}

import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../../AdminChrome";
import { SecretForm } from "../SecretForm";

export default async function NewSecret() {
  await requireAdminPage();
  return (
    <AdminChrome title="新的秘密">
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

import { site } from "@/config/site";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../../AdminChrome";
import { SecretForm } from "../SecretForm";

export default async function NewSecret() {
  await requireAdminPage();
  return (
    <AdminChrome
      title="新的秘密"
      section="/admin/secrets"
      sub
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
          // Today in the site's zone (the server's is UTC) — a starting point, editable.
          date: new Intl.DateTimeFormat("sv-SE", { timeZone: site.timeZone }).format(new Date()),
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

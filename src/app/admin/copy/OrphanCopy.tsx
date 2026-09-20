import { deleteOrphanCopy } from "../actions/copy";
import { DeleteRow } from "../DeleteRow";
import { hintClass } from "../styles";

/**
 * Overrides for keys `messages/*.json` no longer has.
 *
 * Nothing out front reads them and no group lists them, so without this they
 * would sit in the table forever, invisible — and quietly reappear the day a
 * key of that name came back. Listed rather than swept up on sight: a key
 * gone missing is usually a rename, and seeing which one is how you notice.
 */
export function OrphanCopy({ keys }: { keys: string[] }) {
  return (
    <section className="mt-8 border-t border-line pt-6">
      <p className={hintClass}>
        有 {keys.length} 条覆盖对不上任何默认文案——多半是语言文件里改了名或删掉了 key。
        它们在站上不显示，也进不了上面任何一组：
      </p>
      <ul className="mt-2 space-y-0.5 font-mono text-meta text-fg-tertiary">
        {keys.map((key) => (
          <li key={key}>{key}</li>
        ))}
      </ul>
      <DeleteRow
        action={deleteOrphanCopy}
        fields={{}}
        what={`${keys.length} 条对不上的覆盖`}
        label="清理"
      />
    </section>
  );
}

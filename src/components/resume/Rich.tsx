import { Fragment } from "react";
import { parseInline } from "@/lib/resume";

/**
 * A résumé line with its `**strong**` and `` `code` `` spans as elements.
 * No HTML passes through: the runs come out of a parser, and everything it
 * did not recognise is rendered as the text it was.
 */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((run, i) =>
        run.kind === "strong" ? (
          <strong key={i} className="font-semibold text-fg">
            {run.text}
          </strong>
        ) : run.kind === "code" ? (
          <code key={i} className="font-mono text-[0.9em]">
            {run.text}
          </code>
        ) : (
          <Fragment key={i}>{run.text}</Fragment>
        )
      )}
    </>
  );
}

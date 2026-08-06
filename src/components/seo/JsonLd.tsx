export function JsonLd({ data }: { data: Record<string, unknown> }) {
  // `</script>` inside any string value would close this element early, and
  // titles and summaries here come out of an editable database.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}

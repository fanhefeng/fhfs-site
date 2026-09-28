"use client";

import { deletePost, savePost } from "../actions/posts";
import { inputClass, labelClass } from "../styles";
import { LongformForm, type LongformDraft } from "../ui/LongformForm";

type PostDraft = LongformDraft & { tags: string[] };

/** The article editor: the long-form form, and the post's tags. */
export function PostForm({ post, isNew }: { post: PostDraft; isNew: boolean }) {
  return (
    <LongformForm
      action={savePost}
      deleteAction={deletePost}
      doc={post}
      isNew={isNew}
      headCols="sm:grid-cols-[1fr_9rem_10rem]"
      extrasCols="sm:grid-cols-[1fr_auto]"
      extras={
        <label className="space-y-1.5">
          <span className={labelClass}>标签（逗号分隔）</span>
          <input name="tags" defaultValue={post.tags.join(", ")} className={inputClass} />
        </label>
      }
      draftHint="开着就不公开，站上 404"
      bodyLabel="正文（Markdown）"
      datePlaceholder="2026-08-05"
    />
  );
}

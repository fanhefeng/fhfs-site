"use client";

import { postMoment } from "../actions/moments";
import { SaveControls } from "../ui/SaveControls";
import { cardClass, hintClass, textareaClass } from "../styles";
import { useSaveAction } from "../ui/useSaveAction";

/**
 * 发一条: the board's form cut to what a line posted from a phone needs — the
 * words. It sits at the top of the admin's front page, which is also where the
 * home-screen icon opens (`../manifest.webmanifest`). The time, the key and
 * every other field are the full form's defaults, set by the action at the
 * moment it is sent (`postMoment`). Anything more — a picture, a notebook, a
 * quote's source, a draft — is the full form under 说说.
 */
export function QuickMoment() {
  const { state, pending, formProps } = useSaveAction(postMoment);

  return (
    <form {...formProps} className={`${cardClass} space-y-3 p-4`}>
      <label className="block">
        <span className="sr-only">说说正文</span>
        <textarea
          name="content"
          rows={4}
          placeholder="此刻在想什么？"
          className={`${textareaClass} text-body`}
        />
      </label>
      <p className={hintClass}>
        发出去就是公开的，时间按此刻。要配图、选文集、写出处或存草稿，去「说说」里写。
      </p>
      <SaveControls state={state} pending={pending} label="发布" />
    </form>
  );
}

"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  type FormEvent,
} from "react";
import { unstable_rethrow } from "next/navigation";
import type { ActionState } from "../actions/shared";

type SaveAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

const FAILED: ActionState = {
  error: "没保存上：数据库或网络没有应答。这一页的内容还在，稍等一下再按一次保存。",
};

/**
 * `useActionState` for a save form, minus the two things it does that a save
 * form cannot afford. Both end the same way: the article typed since the last
 * save is gone.
 *
 * It resets. React resets a `<form action={fn}>` once `fn` settles — and a
 * returned error is settled. Every field here is uncontrolled, so that reset
 * puts back the last *saved* text: a session that ran out, a date that is not
 * a day, a key already taken, under a line that says the text is still there.
 * So the submit is taken by hand. A submit event that arrives already
 * `preventDefault`ed makes React skip the action (and the reset that rides on
 * it), and the dispatch goes out in a transition started here, which is what
 * keeps `pending` and `useFormStatus` working. `action` stays on the form for
 * the submit that lands before hydration.
 *
 * It throws. An action that *throws* — the database not answering is the one
 * that happens — takes the error to the boundary, and the boundary replaces
 * the editor. Caught here instead and turned into the same line beside the
 * button. `unstable_rethrow` lets Next's own signals through: a `redirect()`
 * inside an action reaches the client as a rejection too.
 *
 * The reset still happens where it was wanted: on `ok`. The inline "new" row
 * under a list goes blank for the next one, and an edit form picks up what
 * the server made of the values — by then the refreshed props are in, so the
 * defaults it resets to are the saved ones.
 */
export function useSaveAction(action: SaveAction) {
  const guarded = useCallback<SaveAction>(
    async (prev, form) => {
      try {
        return await action(prev, form);
      } catch (error) {
        unstable_rethrow(error);
        console.error(error);
        return FAILED;
      }
    },
    [action],
  );
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(guarded, {});
  const formRef = useRef<HTMLFormElement | null>(null);

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      formRef.current = form;
      const { submitter } = event.nativeEvent as SubmitEvent;
      const data = new FormData(form, submitter);
      startTransition(() => dispatch(data));
    },
    [dispatch],
  );

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return { state, pending, formProps: { action: dispatch, onSubmit } };
}

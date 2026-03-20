import type { HelixClientHandlerContext } from "./runtime.js";

interface SubmitPrimitiveMessageResponse {
  thankYou?: string;
  error?: string;
}

function getPrimitiveMessageForm(element: HTMLElement): HTMLFormElement {
  const form =
    element instanceof HTMLFormElement ? element : element.closest("form");

  if (!(form instanceof HTMLFormElement)) {
    throw new Error("submit-primitive-message requires a form target");
  }

  return form;
}

export async function onSubmitPrimitiveMessage({
  event,
  element,
  runtime,
}: HelixClientHandlerContext): Promise<void> {
  event.preventDefault();

  const form = getPrimitiveMessageForm(element);
  if (runtime.primitiveMessageForm.submitting) {
    return;
  }

  const formData = new FormData(form);
  const nextMessage = String(formData.get("message") ?? "");
  const message = nextMessage.trim();

  runtime.primitiveMessageForm = {
    ...runtime.primitiveMessageForm,
    message: nextMessage,
  };

  if (!message) {
    runtime.primitiveMessageForm = {
      ...runtime.primitiveMessageForm,
      response: "Please enter a message.",
      submitting: false,
    };
    return;
  }

  runtime.primitiveMessageForm = {
    ...runtime.primitiveMessageForm,
    response: "Sending message…",
    submitting: true,
  };

  window.alert(message);

  try {
    const fetchResponse = await fetch("/actions/submit-primitive-message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const body = (await fetchResponse.json()) as SubmitPrimitiveMessageResponse;

    if (!fetchResponse.ok) {
      runtime.primitiveMessageForm = {
        ...runtime.primitiveMessageForm,
        response: body.error ?? "Request failed.",
        submitting: false,
      };
      return;
    }

    runtime.primitiveMessageForm = {
      ...runtime.primitiveMessageForm,
      response: body.thankYou ?? "Thank you for your input.",
      submitting: false,
    };
  } catch (error: unknown) {
    console.error("[Helix] submit-primitive-message failed", error);
    runtime.primitiveMessageForm = {
      ...runtime.primitiveMessageForm,
      response: "Could not send message.",
      submitting: false,
    };
  }
}

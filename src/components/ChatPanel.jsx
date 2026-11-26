import { isMentorRoom } from "../data/mentor-room.js";
import { Fragment, useEffect, useRef } from "react";
import { useApp } from "../state/AppContext.jsx";
import ReportCollaborator from "./ReportCollaborator.jsx";
import Avatar from "../components/Avatar.jsx";
import { formatDateTime } from "../data/dates.js";
import { accountVerified, personVerified } from "../data/collaboration.js";
export default function ChatPanel({ room }) {
  const { onSubmit, onAction, state, model } = useApp();
  const chatError =
    state.formErrors?.scope === "chat-form" && state.formErrors.fields.message;
  const partner = model
    .allPeople()
    .find((person) => person.id === room.partnerId);
  const messagesRef = useRef(null);
  const previousCount = useRef(room.messages.length);
  useEffect(() => {
    if (room.messages.length > previousCount.current) {
      messagesRef.current?.scrollIntoView({
        block: "end",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
    previousCount.current = room.messages.length;
  }, [room.messages.length]);
  return (
    <section className="card panel chat room-content">
      <div className="panel-head">
        <div>
          <h2>Room chat</h2>
          <p className="panel-subtitle">
            Messages are shared with your collaborator and saved in this room.
          </p>
        </div>
      </div>
      {"\n          "}
      <div className="chat-messages" id="chat-messages" ref={messagesRef}>
        {room.messages.map((message, itemIndex) => (
          <Fragment key={itemIndex}>
            <div className="message">
              {message.who === "partner" ? (
                <Avatar
                  image={partner?.image}
                  name={message.name}
                  identity={partner?.accountId || room.partnerId}
                  verified={personVerified(partner)}
                  color="coral"
                />
              ) : (
                ""
              )}
              <div className={"bubble " + (message.who === "me" ? "mine" : "")}>
                <span className="message-meta">
                  {message.name}
                  {" · "}
                  {message.timestamp
                    ? formatDateTime(message.timestamp)
                    : message.time}
                </span>
                {message.text}
                {message.who === "partner" &&
                  message.safetyFlags?.length > 0 && (
                    <ReportCollaborator
                      person={partner}
                      messageId={message.id}
                      compact
                    />
                  )}
              </div>
              {message.who === "me" ? (
                <Avatar
                  image={state.profiles[state.role].image}
                  name={message.name}
                  identity={state.accountId}
                  verified={accountVerified(state)}
                />
              ) : (
                ""
              )}
            </div>
          </Fragment>
        ))}
      </div>
      {"\n          "}
      {isMentorRoom(room) &&
      ["launched", "reviewed", "cancelled"].includes(room.status) ? (
        <p>This chat is read-only.</p>
      ) : (
        <form
          className="chat-compose"
          id="chat-form"
          noValidate
          onSubmit={(event) => {
            // An empty message never reaches the server.
            if (!event.currentTarget.elements.message.value.trim()) {
              event.preventDefault();
              onAction({
                action: "request-error",
                scope: "chat-form",
                fields: { message: "Write a message before sending." },
                message: "Write a message before sending.",
              });
              event.currentTarget.elements.message.focus();
              return;
            }
            onSubmit(event);
          }}
        >
          <input
            id="chat-input"
            name="message"
            placeholder="Write a message…"
            aria-label="Write a message"
            aria-invalid={Boolean(chatError)}
            aria-describedby={chatError ? "chat-input-error" : undefined}
          />
          <button className="btn primary" type="submit" disabled={state.busy}>
            Send
          </button>
          {chatError && (
            <p id="chat-input-error" className="field-help field-error">
              {chatError}
            </p>
          )}
        </form>
      )}
    </section>
  );
}

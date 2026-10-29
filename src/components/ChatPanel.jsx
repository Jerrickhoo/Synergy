import { Fragment, useEffect, useRef } from "react";
import { useApp } from "../state/AppContext.jsx";
import Avatar from "../components/Avatar.jsx";
export default function ChatPanel({ room }) {
  const { onSubmit, state, model } = useApp();
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
                  initials={message.initials}
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
                    ? new Date(message.timestamp).toLocaleString()
                    : message.time}
                </span>
                {message.text}
              </div>
              {message.who === "me" ? (
                <Avatar initials={message.initials} />
              ) : (
                ""
              )}
            </div>
          </Fragment>
        ))}
      </div>
      {"\n          "}
      <form
        className="chat-compose"
        id="chat-form"
        onSubmit={(event) => onSubmit(event)}
      >
        <input
          id="chat-input"
          name="message"
          placeholder="Write a message…"
          aria-label="Write a message"
        />
        <button className="btn primary" type="submit" disabled={state.busy}>
          Send
        </button>
      </form>
    </section>
  );
}

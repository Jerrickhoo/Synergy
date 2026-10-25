import Confirmation from "./Confirmation.jsx";
export default function PageHeader({ eyebrow, title, intro, actions = "" }) {
  return (
    <>
      <div className="page-head">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 tabIndex="-1">{title}</h1>
          <p className="intro">{intro}</p>
        </div>
        {actions ? <div className="page-head-actions">{actions}</div> : ""}
      </div>
      <Confirmation />
    </>
  );
}

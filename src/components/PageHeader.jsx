import Confirmation from "./Confirmation.jsx";
export default function PageHeader({ title, intro, actions = "" }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 tabIndex="-1">{title}</h1>
          {intro && <p className="intro">{intro}</p>}
        </div>
        {actions ? <div className="page-head-actions">{actions}</div> : ""}
      </div>
      <Confirmation />
    </>
  );
}

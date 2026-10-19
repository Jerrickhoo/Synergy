import { Fragment } from "react";
export default function Tags({ values, color = "" }) {
  return (
    <div className="tags">
      {values.map((tag, itemIndex) => (
        <Fragment key={itemIndex}>
          <span className={"tag " + color}>{tag}</span>
        </Fragment>
      ))}
    </div>
  );
}

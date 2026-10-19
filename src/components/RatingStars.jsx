import { Fragment } from "react";
export default function RatingStars({ rating }) {
  return (
    <span
      className="rating-stars"
      role="img"
      aria-label={rating + " out of 5 stars"}
    >
      {[1, 2, 3, 4, 5].map((value, itemIndex) => (
        <Fragment key={itemIndex}>
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill={value <= rating ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
          </svg>
        </Fragment>
      ))}
    </span>
  );
}

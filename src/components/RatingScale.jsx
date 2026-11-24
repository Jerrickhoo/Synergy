import SelectField from "./SelectField.jsx";

// One 1–5 review question with its anchors, so "3" means the same to
// everyone: the ends of the scale are named in the options and below.
export default function RatingScale({ category, idPrefix = "rating" }) {
  const id = `${idPrefix}-${category.id}`;
  return (
    <div className="field rating-scale">
      <label htmlFor={id}>{category.label}</label>
      <SelectField
        id={id}
        name={category.id}
        required
        defaultValue=""
        aria-describedby={`${id}-anchors`}
      >
        <option value="" disabled>
          Choose a rating
        </option>
        {[1, 2, 3, 4, 5].map((rating) => (
          <option key={rating} value={rating}>
            {rating === 1
              ? `1 · ${category.low}`
              : rating === 5
                ? `5 · ${category.high}`
                : rating}
          </option>
        ))}
      </SelectField>
      <p className="field-help" id={`${id}-anchors`}>
        1 = {category.low} · 5 = {category.high}
      </p>
    </div>
  );
}

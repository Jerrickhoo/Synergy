// Prototype only: one look for every control that stands in for a fictional
// collaborator or a simulated service, so founders can tell a shortcut from a
// real action. Callers pass their own buttons, keeping busy and error states.
export default function PrototypeShortcut({ note, children }) {
  return (
    <div className="prototype-acceptance">
      <p className="field-help">Prototype only: {note}</p>
      {children}
    </div>
  );
}

import { Link } from "react-router";
import "./ComingSoon.css";
 
type Props = { title: string };
 
export default function ComingSoon({ title }: Props) {
  return (
    <main className="soon">
      <h1>{title}</h1>
      <p>Nothing here yet.</p>
      <Link to="/" className="soon__link">
        Back to the menu
      </Link>
    </main>
  );
}

type LoaderProps = {
  size?: number;
  color?: string;
};
import styles from "./Loader.module.css";

export default function Loader({ size = 48, color = "currentColor" }: LoaderProps) {
  return (
    <div
      className="relative"
      style={{
        width: size,
        color,
      }}
    >
      <div className={styles.loader8} />
    </div>
  );
}

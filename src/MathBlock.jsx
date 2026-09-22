import katex from "katex";
export default function MathBlock({ tex }) {
  return <div className="mb-4 overflow-x-auto" dangerouslySetInnerHTML={{
    __html: katex.renderToString(tex, { displayMode:true, output:"mathml", trust:false, throwOnError:false }),
  }} />;
}

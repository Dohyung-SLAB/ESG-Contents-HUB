export function ExtractionPlaceholder({ jobId }: { jobId: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      Extraction job {jobId}의 PDF 추출 결과 검토 UI가 여기에 표시됩니다.
    </p>
  );
}

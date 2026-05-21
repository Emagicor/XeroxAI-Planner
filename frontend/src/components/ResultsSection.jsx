import AnnotatedImagePanel from './AnnotatedImagePanel'
import ResultActions from './ResultActions'
import RoomTable from './RoomTable'
import SummaryCards from './SummaryCards'

export default function ResultsSection({
  result,
  activeRoom,
  onSelectRoom,
  onDownloadCSV,
  onReset,
}) {
  return (
    <section>
      <div className="flex flex-col lg:flex-row gap-8 mb-4">
        <AnnotatedImagePanel
          annotatedImage={result.annotated_image}
          rooms={result.rooms}
          activeRoom={activeRoom}
          onSelectRoom={onSelectRoom}
        />

        <div className="lg:w-[40%]">
          <SummaryCards result={result} />
          <ResultActions onDownloadCSV={onDownloadCSV} onReset={onReset} />
        </div>
      </div>
      <RoomTable
        rooms={result.rooms}
        activeRoom={activeRoom}
        onSelectRoom={onSelectRoom}
      />
    </section>
  );
}

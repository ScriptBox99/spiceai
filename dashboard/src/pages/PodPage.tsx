import React, { useEffect, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import ReactAutoSizer from 'react-virtualized-auto-sizer'

import PodHeader from '../components/app/PodHeader'
import Card from '../components/layout/Card'
import { usePod } from '../models/pod'
import { useFlights } from '../models/flight'
import { useObservations } from '../models/observation'
import FlightChart from '../components/flights/FlightChart'
import DataEditor, {
  DataEditorContainer,
  GridColumn,
  GridCell,
  GridCellKind,
} from '@glideapps/glide-data-grid'

interface PodProps {
  podName: string
}

interface GridProps {
  columns: GridColumn[]
  gridDataFunc: ([col, row]: readonly [number, number]) => GridCell
}

const defaultGridWidth = 1000
const defaultGridHeight = 600

const PodPage: React.FunctionComponent<PodProps> = () => {
  const location = useLocation()
  const podNamePathIndex = location.pathname.lastIndexOf('/') + 1
  const podName = location.pathname.substring(podNamePathIndex)

  const { data: pod, error: podError } = usePod(podName)
  const { data: flights, error: flightsError } = useFlights(podName)
  const { data: observations, error: observationsError } = useObservations(podName)

  const [gridProps, setGridProps] = useState<GridProps>()

  useEffect(() => {
    if (!pod) {
      return
    }

    const cols: GridColumn[] = []
    const timeCol = { title: 'time', width: 160 }
    cols.push(timeCol)

    const identifiersKeys = pod.identifiers || []
    const measurementsKeys = pod.measurements || []
    const categoriesKeys = pod.categories || []

    const numColumns =
      identifiersKeys.length + measurementsKeys.length + categoriesKeys.length + 1 /* tags */
    const colWidth = (defaultGridWidth - timeCol.width - 32) / numColumns

    for (const i of identifiersKeys) {
      cols.push(getColumn(i, colWidth))
    }

    for (const m of measurementsKeys) {
      cols.push(getColumn(m, colWidth))
    }

    for (const c of categoriesKeys) {
      cols.push(getColumn(c, colWidth))
    }

    cols.push({ title: 'tags', width: colWidth })

    if (observations && observations.length) {
      const getGridDataFunc = ([col, row]: readonly [number, number]): GridCell => {
        if (row >= observations.length) {
          return {
            kind: GridCellKind.Number,
            data: undefined,
            displayData: '',
            allowOverlay: false,
          }
        }
        const observation = observations[observations.length - row - 1]

        let startCol = 0
        let endCol = startCol + 1
        if (col === startCol) {
          return {
            kind: GridCellKind.Number,
            data: observation.time,
            displayData: new Date(observation.time * 1000).toLocaleString(),
            allowOverlay: false,
          }
        }

        startCol = endCol
        endCol = startCol + identifiersKeys.length

        if (col >= startCol && col < endCol) {
          const identifier = observation.identifiers
            ? observation.identifiers[identifiersKeys[col - startCol]]
            : ''
          return {
            kind: GridCellKind.Text,
            data: identifier,
            displayData: identifier,
            allowOverlay: false,
          }
        }

        startCol = endCol
        endCol = startCol + measurementsKeys.length

        if (col >= startCol && col < endCol) {
          const measurement = observation.measurements
            ? observation.measurements[measurementsKeys[col - startCol]]
            : undefined
          return {
            kind: GridCellKind.Number,
            data: measurement,
            displayData: measurement?.toString() || '',
            allowOverlay: false,
          }
        }

        startCol = endCol
        endCol = startCol + categoriesKeys.length

        if (col >= startCol && col < endCol) {
          const category = observation.categories
            ? observation.categories[categoriesKeys[col - startCol]]
            : ''
          return {
            kind: GridCellKind.Text,
            data: category,
            displayData: category,
            allowOverlay: false,
          }
        }

        if (col == numColumns) {
          const tags = observation.tags ? observation.tags.join(' ') : ''
          return {
            kind: GridCellKind.Text,
            data: tags,
            displayData: tags,
            allowOverlay: false,
          }
        }

        return {
          kind: GridCellKind.Number,
          data: row,
          displayData: row.toString(),
          allowOverlay: false,
        }
      }

      setGridProps({
        columns: cols,
        gridDataFunc: getGridDataFunc,
      })
    }
  }, [observations])

  const onColumnResized = useCallback(
    (col: GridColumn, newSize: number) => {
      if (!gridProps) {
        return
      }

      const cols = gridProps.columns || []
      const index = cols.indexOf(col)
      const newCols = [...cols]
      newCols[index] = {
        ...newCols[index],
        width: newSize,
      }
      setGridProps({
        columns: newCols,
        gridDataFunc: gridProps.gridDataFunc,
      })
    },
    [gridProps]
  )

  return (
    <div className="flex flex-col flex-grow">
      {!podError && pod && (
        <div className="mb-2">
          <PodHeader pod={pod} flights={flights}></PodHeader>
          <h2 className="ml-2 mb-2 font-spice tracking-spice text-s uppercase">Observations</h2>
          {observationsError && (
            <span>An error occurred fetching observations: {observationsError}</span>
          )}
          {!observationsError && observations && gridProps && (
            <div className="border-1 border-gray-300">
              <ReactAutoSizer disableHeight={true} defaultHeight={defaultGridHeight}>
                {(props: { width?: number }) => (
                  <DataEditorContainer
                    width={props.width ?? defaultGridWidth}
                    height={defaultGridHeight}
                  >
                    <DataEditor
                      getCellContent={gridProps.gridDataFunc}
                      columns={gridProps.columns}
                      rows={observations.length}
                      rowMarkers="number"
                      onColumnResized={onColumnResized}
                    />
                  </DataEditorContainer>
                )}
              </ReactAutoSizer>
            </div>
          )}
          <h2 className="mt-4 ml-2 mb-2 font-spice tracking-spice text-s uppercase">
            Training Runs
          </h2>
          <div className="p-2">
            {!flightsError &&
              flights.map((flight, i) => (
                <div key={i}>
                  <Card>
                    {flight.episodes?.length && flight.episodes[0].error ? (
                      <div className="m-2 flex flex-col items-center justify-center">
                        <div className="text-red-500 text-center">
                          <h4 className="uppercase font-semibold">Flight Error</h4>
                          {flight.episodes.map((episode, i) => (
                            <div key={i}>
                              {episode.error}: {episode.error_message}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <FlightChart pod={pod} flight={flight} />
                    )}
                  </Card>
                </div>
              ))}
            {(!flights || flights.length === 0) && <span>Pod has no training runs.</span>}
          </div>
        </div>
      )}
    </div>
  )
}

const getColumn = (title: string, width: number): GridColumn => {
  const lastDotIndex = title.lastIndexOf('.')
  return {
    title: title.substr(lastDotIndex + 1),
    group: title.substr(0, lastDotIndex),
    width: width,
  }
}

export default PodPage

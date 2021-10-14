import React from 'react'
import ReactDOMServer from 'react-dom/server'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { Segment, Icon } from 'semantic-ui-react'

import {
  getIndividualsByGuid,
  getIGVSamplesByFamilySampleIndividual,
  getFamiliesByGuid,
  getProjectsByGuid,
} from 'redux/selectors'
import PedigreeIcon from '../../icons/PedigreeIcon'
import { CheckboxGroup } from '../../form/Inputs'
import IGV from '../../graph/IGV'
import { ButtonLink } from '../../StyledComponents'
import { VerticalSpacer } from '../../Spacers'
import { getLocus } from '../variants/VariantUtils'
import { AFFECTED } from '../../../utils/constants'
import {
  ALIGNMENT_TYPE, COVERAGE_TYPE, GCNV_TYPE, JUNCTION_TYPE, BUTTON_PROPS, TRACK_OPTIONS,
  GTEX_TRACK_OPTIONS, MAPPABILITY_TRACK_OPTIONS, CRAM_PROXY_TRACK_OPTIONS, BAM_TRACK_OPTIONS,
  DNA_TRACK_TYPE_OPTIONS, RNA_TRACK_TYPE_OPTIONS, IGV_OPTIONS, REFERENCE_LOOKUP, RNA_TRACK_TYPE_LOOKUP,
} from './constants'

const MIN_LOCUS_RANGE_SIZE = 100

const getTrackOptions = (type, sample, individual) => {
  const name = ReactDOMServer.renderToString(
    <span id={`${individual.displayName}-${type}`}>
      <PedigreeIcon sex={individual.sex} affected={individual.affected} />
      {individual.displayName}
    </span>,
  )

  const url = `/api/project/${sample.projectGuid}/igv_track/${encodeURIComponent(sample.filePath)}`

  return { url, name, type, ...TRACK_OPTIONS[type] }
}

const getIgvTracks = (igvSampleIndividuals, individualsByGuid, sampleTypes) => {
  const gcnvSamplesByBatch = Object.entries(igvSampleIndividuals[GCNV_TYPE] || {}).reduce(
    (acc, [individualGuid, { filePath, sampleId }]) => {
      if (!acc[filePath]) {
        acc[filePath] = {}
      }
      acc[filePath][individualGuid] = sampleId
      return acc
    }, {},
  )

  const getIndivSampleType =
    (type, individualGuid) => sampleTypes.includes(type) && (igvSampleIndividuals[type] || {})[individualGuid]

  return Object.entries(igvSampleIndividuals).reduce((acc, [type, samplesByIndividual]) => (
    sampleTypes.includes(type) ? [
      ...acc,
      ...Object.entries(samplesByIndividual).map(([individualGuid, sample]) => {
        const individual = individualsByGuid[individualGuid]
        const track = getTrackOptions(type, sample, individual)

        if (type === ALIGNMENT_TYPE) {
          if (sample.filePath.endsWith('.cram')) {
            if (sample.filePath.startsWith('gs://')) {
              Object.assign(track, {
                format: 'cram',
                indexURL: `${track.url}.crai`,
              })
            } else {
              Object.assign(track, CRAM_PROXY_TRACK_OPTIONS)
            }
          } else {
            Object.assign(track, BAM_TRACK_OPTIONS)
          }
        } else if (type === JUNCTION_TYPE) {
          track.indexURL = `${track.url}.tbi`

          const coverageSample = getIndivSampleType(COVERAGE_TYPE, individualGuid)
          if (coverageSample) {
            const coverageTrack = getTrackOptions(COVERAGE_TYPE, coverageSample, individual)
            return {
              type: 'merged',
              name: track.name,
              height: track.height,
              tracks: [coverageTrack, track],
            }
          }
        } else if (type === COVERAGE_TYPE && getIndivSampleType(JUNCTION_TYPE, individualGuid)) {
          return null
        } else if (type === GCNV_TYPE) {
          const batch = gcnvSamplesByBatch[sample.filePath]
          const individualGuids = Object.keys(batch).sort()

          return individualGuids[0] === individualGuid ? {
            ...track,
            indexURL: `${track.url}.tbi`,
            highlightSamples: Object.entries(batch).reduce((higlightAcc, [iGuid, sampleId]) => ({
              [sampleId || individualsByGuid[iGuid].individualId]:
                individualsByGuid[iGuid].affected === AFFECTED ? 'red' : 'blue',
              ...higlightAcc,
            }), {}),
            name: individualGuids.length === 1 ? track.name : individualGuids.map(
              iGuid => individualsByGuid[iGuid].displayName,
            ).join(', '),
          } : null
        }

        return track
      }),
    ] : acc
  ), []).filter(track => track)
}

const ShowIgvButton = ({ type, showReads, ...props }) => (BUTTON_PROPS[type] ? (
  <ButtonLink
    padding="0 0 0 1em"
    onClick={showReads && showReads(type === JUNCTION_TYPE ? [JUNCTION_TYPE, COVERAGE_TYPE] : [type])}
    {...BUTTON_PROPS[type]}
    {...props}
  />
) : null)

ShowIgvButton.propTypes = {
  type: PropTypes.string,
  familyGuid: PropTypes.string,
  showReads: PropTypes.func,
}

const ReadButtons = React.memo((
  { variant, familyGuid, igvSamplesByFamilySampleIndividual, familiesByGuid, buttonProps, showReads },
) => {
  const familyGuids = variant ? variant.familyGuids : [familyGuid]

  const sampleTypeFamilies = familyGuids.reduce(
    (acc, fGuid) => {
      Object.keys((igvSamplesByFamilySampleIndividual || {})[fGuid] || {}).forEach((type) => {
        if (!acc[type]) {
          acc[type] = []
        }
        acc[type].push(fGuid)
      })
      return acc
    }, {},
  )

  if (!Object.keys(sampleTypeFamilies).length) {
    return null
  }

  if (familyGuids.length === 1) {
    return Object.keys(sampleTypeFamilies).map(
      type => <ShowIgvButton key={type} type={type} {...buttonProps} showReads={showReads(familyGuids[0])} />,
    )
  }

  return Object.entries(sampleTypeFamilies).reduce((acc, [type, fGuids]) => ([
    ...acc,
    <ShowIgvButton key={type} type={type} {...buttonProps} />,
    ...fGuids.map(fGuid => (
      <ShowIgvButton
        key={`${fGuid}-${type}`}
        content={`| ${familiesByGuid[fGuid].familyId}`}
        icon={null}
        type={type}
        showReads={showReads(fGuid)}
        padding="0"
      />
    )),
  ]), [])
})

ReadButtons.propTypes = {
  variant: PropTypes.object,
  familyGuid: PropTypes.string,
  buttonProps: PropTypes.object,
  familiesByGuid: PropTypes.object,
  igvSamplesByFamilySampleIndividual: PropTypes.object,
  showReads: PropTypes.func,
}

const IgvPanel = React.memo((
  { variant, igvSampleIndividuals, individualsByGuid, project, sampleTypes, rnaReferences },
) => {
  const size = variant.end && variant.end - variant.pos
  const locus = variant && getLocus(
    variant.chrom,
    (variant.genomeVersion !== project.genomeVersion && variant.liftedOverPos) ? variant.liftedOverPos : variant.pos,
    size ? Math.max(parseInt(size / 3, 10), MIN_LOCUS_RANGE_SIZE) : MIN_LOCUS_RANGE_SIZE,
    size,
  )

  const tracks = rnaReferences.concat(getIgvTracks(igvSampleIndividuals, individualsByGuid, sampleTypes))

  return (
    <IGV tracks={tracks} reference={REFERENCE_LOOKUP[project.genomeVersion]} locus={locus} {...IGV_OPTIONS} />
  )
})

IgvPanel.propTypes = {
  variant: PropTypes.object,
  sampleTypes: PropTypes.arrayOf(PropTypes.string),
  rnaReferences: PropTypes.arrayOf(PropTypes.object),
  individualsByGuid: PropTypes.object,
  igvSampleIndividuals: PropTypes.object,
  project: PropTypes.object,
}

class FamilyReads extends React.PureComponent {

  static propTypes = {
    variant: PropTypes.object,
    layout: PropTypes.elementType,
    familyGuid: PropTypes.string,
    buttonProps: PropTypes.object,
    projectsByGuid: PropTypes.object,
    familiesByGuid: PropTypes.object,
    individualsByGuid: PropTypes.object,
    igvSamplesByFamilySampleIndividual: PropTypes.object,
  }

  state = {
    openFamily: null,
    sampleTypes: [],
    rnaReferences: [],
  }

  showReads = familyGuid => sampleTypes => () => {
    this.setState({
      openFamily: familyGuid,
      sampleTypes,
    })
  }

  hideReads = () => {
    this.setState({
      openFamily: null,
      sampleTypes: [],
      rnaReferences: [],
    })
  }

  updateSampleTypes = (sampleTypes) => {
    if (sampleTypes.some(sampleType => RNA_TRACK_TYPE_LOOKUP.has(sampleType))) {
      this.setState({
        sampleTypes,
      })
    } else {
      this.setState({
        sampleTypes,
        rnaReferences: [],
      })
    }
  }

  updateRnaReferences = (rnaReferences) => {
    this.setState({
      rnaReferences,
    })
  }

  render() {
    const {
      variant, familyGuid, buttonProps, layout, igvSamplesByFamilySampleIndividual, individualsByGuid, familiesByGuid,
      projectsByGuid, ...props
    } = this.props
    const { openFamily, sampleTypes, rnaReferences } = this.state

    const showReads = (
      <ReadButtons
        variant={variant}
        familyGuid={familyGuid}
        buttonProps={buttonProps}
        igvSamplesByFamilySampleIndividual={igvSamplesByFamilySampleIndividual}
        familiesByGuid={familiesByGuid}
        showReads={this.showReads}
      />
    )

    const igvSampleIndividuals = (
      openFamily && (igvSamplesByFamilySampleIndividual || {})[openFamily]) || {}
    const dnaTrackOptions = DNA_TRACK_TYPE_OPTIONS.filter(({ value }) => igvSampleIndividuals[value])
    const rnaTrackOptions = RNA_TRACK_TYPE_OPTIONS.filter(({ value }) => igvSampleIndividuals[value])
    const reads = Object.keys(igvSampleIndividuals).length > 0 ? (
      <Segment.Group horizontal>
        {(dnaTrackOptions.length > 1 || rnaTrackOptions.length > 0) && (
          <Segment>
            {dnaTrackOptions.length > 0 && (
              <CheckboxGroup
                groupLabel="DNA Tracks"
                value={sampleTypes}
                options={dnaTrackOptions}
                onChange={this.updateSampleTypes}
              />
            )}
            {rnaTrackOptions.length > 0 && (
              <div>
                <CheckboxGroup
                  groupLabel="RNA Tracks"
                  value={sampleTypes}
                  options={rnaTrackOptions}
                  onChange={this.updateSampleTypes}
                />
                {sampleTypes.some(sampleType => RNA_TRACK_TYPE_LOOKUP.has(sampleType)) && (
                  <div>
                    <b>RNA-seq Reference Tracks</b>
                    <CheckboxGroup
                      groupLabel="GTEx Tracks"
                      value={rnaReferences}
                      options={GTEX_TRACK_OPTIONS}
                      onChange={this.updateRnaReferences}
                    />
                    <CheckboxGroup
                      groupLabel="Mappability Tracks"
                      value={rnaReferences}
                      options={MAPPABILITY_TRACK_OPTIONS}
                      onChange={this.updateRnaReferences}
                    />
                  </div>
                )}
              </div>
            )}
          </Segment>
        )}
        <Segment>
          <ButtonLink onClick={this.hideReads} icon={<Icon name="remove" color="grey" />} floated="right" size="large" />
          <VerticalSpacer height={20} />
          <IgvPanel
            variant={variant}
            igvSampleIndividuals={igvSampleIndividuals}
            sampleTypes={sampleTypes}
            rnaReferences={rnaReferences}
            individualsByGuid={individualsByGuid}
            project={projectsByGuid[familiesByGuid[openFamily].projectGuid]}
          />
        </Segment>
      </Segment.Group>
    ) : null

    return React.createElement(layout, { variant, reads, showReads, ...props })
  }

}

const mapStateToProps = state => ({
  igvSamplesByFamilySampleIndividual: getIGVSamplesByFamilySampleIndividual(state),
  individualsByGuid: getIndividualsByGuid(state),
  familiesByGuid: getFamiliesByGuid(state),
  projectsByGuid: getProjectsByGuid(state),
})

export default connect(mapStateToProps)(FamilyReads)

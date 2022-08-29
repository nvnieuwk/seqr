import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'
import { Popup, Divider } from 'semantic-ui-react'

import { HorizontalSpacer, VerticalSpacer } from '../../Spacers'
import { GENOME_VERSION_37, GENOME_VERSION_38, getVariantMainGeneId } from '../../../utils/constants'
import { GNOMAD_SV_CRITERIA_MESSAGE, SV_CALLSET_CRITERIA_MESSAGE } from '../search/constants'

const FreqValue = styled.span`
  color: black;
`

const FreqLink = React.memo(({ urls, value, displayValue, variant, queryParams, getPath }) => {
  let { chrom, pos, genomeVersion } = variant
  if (!urls[genomeVersion] && urls[variant.liftedOverGenomeVersion]) {
    chrom = variant.liftedOverChrom
    pos = variant.liftedOverPos
    genomeVersion = variant.liftedOverGenomeVersion
  }

  const path = getPath({ chrom, pos, genomeVersion, variant, value })

  const queryString = (queryParams && queryParams[genomeVersion]) ? `?${queryParams[genomeVersion]}` : ''

  return (
    <a href={`http://${urls[genomeVersion]}/${path}${queryString}`} target="_blank" rel="noreferrer">
      {displayValue || value}
    </a>
  )
})

FreqLink.propTypes = {
  urls: PropTypes.object.isRequired,
  value: PropTypes.string,
  displayValue: PropTypes.string,
  variant: PropTypes.object.isRequired,
  queryParams: PropTypes.object,
  getPath: PropTypes.func,
}

const getFreqLinkPath = ({ chrom, pos, variant, value }) => {
  const floatValue = parseFloat(value, 10)
  const isRegion = floatValue <= 0
  let coords
  if (Number.isNaN(floatValue)) {
    coords = value
  } else if (isRegion) {
    const posInt = parseInt(pos, 10)
    const endOffset = variant.end ? variant.end - variant.pos : 0
    coords = `${chrom}-${Math.max(posInt - 100, 1)}-${posInt + endOffset + 100}`
  } else {
    coords = `${chrom}-${pos}-${variant.ref}-${variant.alt}`
  }

  return `${isRegion ? 'region' : 'variant'}/${coords}`
}

const FreqSummary = React.memo((props) => {
  const { field, fieldTitle, variant, urls, queryParams, acDisplay, titleContainer, precision = 2 } = props
  const { populations = {}, chrom } = variant
  const population = populations[field] || {}
  if (population.af === null || population.af === undefined) {
    return null
  }
  const afValue = population.af > 0 ? population.af.toPrecision(precision) : '0.0'
  const value = population.id ? population.id.replace('gnomAD-SV_v2.1_', '') : afValue
  const displayValue = population.filter_af > 0 ? population.filter_af.toPrecision(precision) : afValue

  return (
    <div>
      {titleContainer ? titleContainer(props) : fieldTitle}
      <HorizontalSpacer width={5} />
      <FreqValue>
        <b>
          {urls ? (
            <FreqLink
              urls={urls}
              queryParams={queryParams}
              value={value}
              displayValue={displayValue}
              variant={variant}
              getPath={getFreqLinkPath}
            />
          ) : displayValue}
        </b>
        {population.hom !== null && population.hom !== undefined && (
          <span>
            <HorizontalSpacer width={5} />
            {`Hom=${population.hom}`}
          </span>
        )}
        {population.het !== null && population.het !== undefined && (
          <span>
            <HorizontalSpacer width={5} />
            {`Het=${population.het}`}
          </span>
        )}
        {chrom.endsWith('X') && population.hemi !== null && population.hemi !== undefined && (
          <span>
            <HorizontalSpacer width={5} />
            {`Hemi=${population.hemi}`}
          </span>
        )}
        {acDisplay && population.ac !== null && population.ac !== undefined && (
          <span>
            <HorizontalSpacer width={5} />
            {`${acDisplay}=${population.ac} out of ${population.an}`}
          </span>
        )}
      </FreqValue>
    </div>
  )
})

FreqSummary.propTypes = {
  field: PropTypes.string.isRequired,
  variant: PropTypes.object.isRequired,
  precision: PropTypes.number,
  fieldTitle: PropTypes.string,
  titleContainer: PropTypes.func,
  urls: PropTypes.object,
  queryParams: PropTypes.object,
  acDisplay: PropTypes.string,
}

const getGenePath = ({ variant }) => `gene/${getVariantMainGeneId(variant)}`

const gnomadLink = ({ fieldTitle, ...props }) => {
  const [detail, ...linkName] = fieldTitle.split(' ').reverse()
  return (
    <span>
      <FreqLink {...props} displayValue={linkName.reverse().join(' ')} getPath={getGenePath} />
      &nbsp;
      {detail}
    </span>
  )
}

gnomadLink.propTypes = {
  fieldTitle: PropTypes.string,
}

const GNOMAD_URL_INFO = {
  urls: { [GENOME_VERSION_38]: 'gnomad.broadinstitute.org' },
  queryParams: { [GENOME_VERSION_38]: 'dataset=gnomad_r3' },
}

const catalogTitle = ({ fieldTitle, catalog }) => (
  <span>
    {fieldTitle}
    &nbsp;
    {catalog.toLowerCase()}
  </span>
)

catalogTitle.propTypes = {
  fieldTitle: PropTypes.string,
  isMito: PropTypes.bool,
  catalog: PropTypes.string,
}

const POPULATIONS = [
  { field: 'sv_callset', fieldTitle: 'This Callset', acDisplay: 'AC', helpMessage: SV_CALLSET_CRITERIA_MESSAGE },
  {
    field: 'callset',
    fieldTitle: 'This Callset',
    acDisplay: 'AC',
    titleContainer: catalogTitle,
    catalog: 'Homoplasmy',
  },
  { field: 'g1k', fieldTitle: '1kg WGS' },
  {
    field: 'exac',
    fieldTitle: 'ExAC',
    urls: { [GENOME_VERSION_37]: 'gnomad.broadinstitute.org' },
    queryParams: { [GENOME_VERSION_37]: 'dataset=exac' },
  },
  {
    field: 'gnomad_exomes',
    fieldTitle: 'gnomAD v2 exomes',
    titleContainer: gnomadLink,
    urls: { [GENOME_VERSION_37]: 'gnomad.broadinstitute.org' },
  },
  {
    field: 'gnomad_genomes',
    fieldTitle: 'gnomAD v3 genomes',
    titleContainer: gnomadLink,
    precision: 3,
    urls: { [GENOME_VERSION_37]: 'gnomad.broadinstitute.org', [GENOME_VERSION_38]: 'gnomad.broadinstitute.org' },
    queryParams: { [GENOME_VERSION_38]: 'dataset=gnomad_r3' },
  },
  {
    field: 'topmed',
    fieldTitle: 'TopMed',
    precision: 3,
    urls: {
      [GENOME_VERSION_37]: 'bravo.sph.umich.edu/freeze3a/hg19',
      [GENOME_VERSION_38]: 'bravo.sph.umich.edu/freeze5/hg38',
    },
  },
  {
    field: 'gnomad_svs',
    fieldTitle: 'gnomAD SVs',
    precision: 3,
    urls: { [GENOME_VERSION_37]: 'gnomad.broadinstitute.org' },
    queryParams: { [GENOME_VERSION_37]: 'dataset=gnomad_sv_r2_1' },
    helpMessage: GNOMAD_SV_CRITERIA_MESSAGE,
  },
  {
    field: 'callset_heteroplasmy',
    fieldTitle: 'This Callset',
    titleContainer: catalogTitle,
    catalog: 'Heteroplasmy',
    acDisplay: 'AC',
    precision: 3,
  },
  {
    field: 'gnomad_mito',
    fieldTitle: 'gnomAD mito',
    titleContainer: catalogTitle,
    catalog: 'Homoplasmy',
    precision: 3,
    ...GNOMAD_URL_INFO,
  },
  {
    field: 'gnomad_mito_heteroplasmy',
    fieldTitle: 'gnomAD mito',
    titleContainer: catalogTitle,
    catalog: 'Heteroplasmy',
    precision: 3,
    ...GNOMAD_URL_INFO,
  },
  {
    field: 'helix',
    fieldTitle: 'Helix mito',
    titleContainer: catalogTitle,
    catalog: 'Homoplasmy',
    precision: 3,
  },
  {
    field: 'helix_heteroplasmy',
    fieldTitle: 'Helix mito',
    titleContainer: catalogTitle,
    catalog: 'Heteroplasmy',
    precision: 3,
  },
]

const Frequencies = React.memo(({ variant }) => {
  const { populations = {} } = variant
  const callsetHetPop = populations.callset_heteroplasmy
  const isMito = callsetHetPop && callsetHetPop.af !== null && callsetHetPop.af !== undefined
  const popupPoputionByCat = POPULATIONS.reduce((acc, pop) => {
    let catalog = null
    let detailField
    if (!isMito && populations[pop.field]) {
      if (populations[pop.field].ac) {
        catalog = 'Allele Counts'
        detailField = 'ac'
      }
      if (populations[pop.field] && populations[pop.field].filter_af &&
          (populations[pop.field].filter_af !== populations[pop.field].af)) {
        catalog = 'Global AFs'
        detailField = 'af'
      }
    }
    if (isMito && pop.catalog && populations[pop.field]) {
      if (populations[pop.field].ac) {
        catalog = pop.catalog
        detailField = 'ac'
      }
      if (populations[pop.field].max_hl) {
        catalog = 'Max Observed Heteroplasmy'
        detailField = 'max_hl'
      }
    }
    if (catalog) {
      if (!acc[catalog]) {
        acc[catalog] = []
      }
      acc[catalog].push({ ...pop, detailField })
    }
    return acc
  }, {})

  const catalogs = Object.keys(popupPoputionByCat)
  catalogs.sort()

  const freqContent = <div>{POPULATIONS.map(pop => <FreqSummary key={pop.field} variant={variant} {...pop} />)}</div>

  const hasHelpMessagePops = POPULATIONS.filter(
    pop => pop.helpMessage && populations[pop.field] && populations[pop.field].af !== null,
  )

  return (
    (hasHelpMessagePops.length || catalogs.length) ? (
      <Popup position="top center" wide="very" trigger={freqContent}>
        {catalogs.map((catalog, i) => (
          <div key={catalog}>
            {(i > 0) && <VerticalSpacer height={5} />}
            <Popup.Header content={catalog} />
            {popupPoputionByCat[catalog].map((pop) => {
              if (pop.detailField === 'ac') {
                return (
                  <Popup.Content key={pop.field}>
                    {`${pop.fieldTitle}: ${populations[pop.field].ac} out of ${populations[pop.field].an}`}
                  </Popup.Content>
                )
              }
              return (
                <Popup.Content key={pop.field}>
                  {`${pop.fieldTitle} : ${populations[pop.field][pop.detailField].toPrecision(pop.precision || 2)}`}
                </Popup.Content>
              )
            })}
          </div>
        ))}
        {hasHelpMessagePops.map(pop => (
          <Popup.Content key={pop.field}>
            <Divider />
            <i>
              {pop.helpMessage}
            </i>
          </Popup.Content>
        ))}
      </Popup>
    ) : freqContent
  )
})

Frequencies.propTypes = {
  variant: PropTypes.object,
}

export default Frequencies

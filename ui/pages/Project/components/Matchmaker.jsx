import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { Header, Icon, List, Accordion, Popup, Label, Grid } from 'semantic-ui-react'
import styled from 'styled-components'

import { getIndividualsByGuid, getGenesById, getMmeResultsByGuid, getSortedIndividualsByFamily } from 'redux/selectors'
import ShowGeneModal from 'shared/components/buttons/ShowGeneModal'
import DeleteButton from 'shared/components/buttons/DeleteButton'
import UpdateButton from 'shared/components/buttons/UpdateButton'
import { BooleanCheckbox, BaseSemanticInput } from 'shared/components/form/Inputs'
import BaseFieldView from 'shared/components/panel/view-fields/BaseFieldView'
import { Alleles } from 'shared/components/panel/variants/VariantIndividuals'
import SortableTable, { SelectableTableFormInput } from 'shared/components/table/SortableTable'
import DataLoader from 'shared/components/DataLoader'
import { HorizontalSpacer, VerticalSpacer } from 'shared/components/Spacers'
import { ButtonLink, ColoredLabel } from 'shared/components/StyledComponents'
import { AFFECTED } from 'shared/utils/constants'
import { camelcaseToTitlecase } from 'shared/utils/stringUtils'

import { loadMmeMatches, updateMmeSubmission, updateMmeSubmissionStatus, loadProjectVariants } from '../reducers'
import {
  getMatchmakerMatchesLoading,
  getMonarchMatchesLoading,
  getProjectSavedVariantsIsLoading,
  getIndividualTaggedVariants,
  getDefaultMmeSubmissionByIndividual,
} from '../selectors'

const PhenotypeListItem = styled(List.Item)`
  text-decoration: ${props => (props.observed === 'no' ? 'line-through' : 'none')};
`

const BreakWordLink = styled.a`
  word-break: break-all;
`

const MatchContainer = styled.div`
  word-break: break-all;
`

const PATIENT_FIELDS = ['label', 'sex', 'ageOfOnset', 'inheritanceMode', 'species']

const MATCH_STATUS_EDIT_FIELDS = [
  { name: 'weContacted', label: 'We Contacted Host', component: BooleanCheckbox, inline: true },
  { name: 'hostContacted', label: 'Host Contacted Us', component: BooleanCheckbox, inline: true },
  { name: 'flagForAnalysis', label: 'Flag for Analysis', component: BooleanCheckbox, inline: true },
  { name: 'deemedIrrelevant', label: 'Deemed Irrelevant', component: BooleanCheckbox, inline: true },
  { name: 'comments', label: 'Comments', component: BaseSemanticInput, inputType: 'TextArea', rows: 5 },
]

const variantSummary = variant => (
  <span>
    {variant.chrom}:{variant.pos}
    {variant.alt && <span> {variant.ref} <Icon fitted name="angle right" /> {variant.alt}</span>}
  </span>
)

const GENOTYPE_FIELDS = [
  { name: 'geneSymbol', content: 'Gene', width: 2 },
  { name: 'xpos', content: 'Variant', width: 3, format: val => variantSummary(val) },
  { name: 'numAlt', content: 'Genotype', width: 2, format: val => <Alleles variant={val} numAlt={val.numAlt} /> },
  {
    name: 'tags',
    content: 'Tags',
    width: 8,
    format: val => val.tags.map(tag =>
      <ColoredLabel key={tag.tagGuid}size="small" color={tag.color} horizontal content={tag.name} />,
    ),
  },
]

const BaseEditGenotypesTable = ({ familyGuids, savedVariants, loading, load, value, onChange }) =>
  <DataLoader contentId={familyGuids} content load={load} loading={false}>
    <SelectableTableFormInput
      idField="variantId"
      defaultSortColumn="xpos"
      columns={GENOTYPE_FIELDS}
      data={savedVariants}
      value={value}
      onChange={newValue => onChange(savedVariants.filter(variant => newValue[variant.variantId]))}
      loading={loading}
    />
  </DataLoader>

BaseEditGenotypesTable.propTypes = {
  familyGuids: PropTypes.array,
  savedVariants: PropTypes.array,
  loading: PropTypes.bool,
  load: PropTypes.func,
  value: PropTypes.object,
  onChange: PropTypes.func,
}

const mapGenotypesStateToProps = (state, ownProps) => {
  const individualGuid = ownProps.meta.form.split('_-_')[0]
  return {
    familyGuids: [getIndividualsByGuid(state)[individualGuid].familyGuid],
    savedVariants: getIndividualTaggedVariants(state, { individualGuid }),
    loading: getProjectSavedVariantsIsLoading(state),
  }
}

const mapGenotypesDispatchToProps = {
  load: loadProjectVariants,
}

const EditGenotypesTable = connect(mapGenotypesStateToProps, mapGenotypesDispatchToProps)(BaseEditGenotypesTable)

const PHENOTYPE_FIELDS = [
  { name: 'id', content: 'HPO ID', width: 3 },
  { name: 'label', content: 'Description', width: 9 },
  {
    name: 'observed',
    content: 'Observed?',
    width: 3,
    textAlign: 'center',
    format: val =>
      <Icon name={val.observed === 'yes' ? 'check' : 'remove'} color={val.observed === 'yes' ? 'green' : 'red'} />,
  },
]

const BaseEditPhenotypesTable = ({ individual, value, onChange }) =>
  <SelectableTableFormInput
    idField="id"
    defaultSortColumn="label"
    columns={PHENOTYPE_FIELDS}
    data={individual.phenotipsData.features}
    value={value}
    onChange={newValue => onChange(individual.phenotipsData.features.filter(feature => newValue[feature.id]))}
  />

BaseEditPhenotypesTable.propTypes = {
  individual: PropTypes.object,
  value: PropTypes.object,
  onChange: PropTypes.func,
}

const mapPhenotypeStateToProps = (state, ownProps) => ({
  individual: getIndividualsByGuid(state)[ownProps.meta.form.split('_-_')[0]],
})

const EditPhenotypesTable = connect(mapPhenotypeStateToProps)(BaseEditPhenotypesTable)

const CONTACT_URL_REGEX = /^mailto:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}([,][A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4})*$/i
const SUBMISSION_EDIT_FIELDS = [
  { name: 'patient.contact.name', label: 'Contact Name' },
  {
    name: 'patient.contact.href',
    label: 'Contact URL',
    parse: val => `mailto:${val}`,
    format: val => val.replace('mailto:', ''),
    validate: val => (CONTACT_URL_REGEX.test(val) ? undefined : 'Invalid contact url'),
  },
  {
    name: 'geneVariants',
    component: EditGenotypesTable,
    format: value => (value || []).reduce((acc, variant) =>
      ({ ...acc, [variant.variantId || `${variant.chrom}-${variant.pos}-${variant.ref}-${variant.alt}`]: true }), {}),
  },
  {
    name: 'phenotypes',
    component: EditPhenotypesTable,
    format: value => value.reduce((acc, feature) => ({ ...acc, [feature.id]: true }), {}),
    validate: (val, allValues) => ((val && val.length) || (allValues.geneVariants && allValues.geneVariants.length) ?
      undefined : 'Genotypes and/or phenotypes are required'),
  },
]

const contactedLabel = (val) => {
  if (val.hostContacted) {
    return 'Host Contacted Us'
  }
  return val.weContacted ? 'We Contacted Host' : 'Not Contacted'
}

const BaseMatchStatus = ({ initialValues, onSubmit }) =>
  <BaseFieldView
    initialValues={initialValues}
    field="matchStatus"
    idField="matchmakerResultGuid"
    compact
    isEditable
    showErrorPanel
    modalTitle="Edit MME Submission Status"
    formFields={MATCH_STATUS_EDIT_FIELDS}
    onSubmit={onSubmit}
    fieldDisplay={val =>
      <div>
        <Label horizontal content={contactedLabel(val)} color={val.hostContacted || val.weContacted ? 'green' : 'orange'} />
        {val.flagForAnalysis && <Label horizontal content="Flag for Analysis" color="purple" />}
        {val.deemedIrrelevant && <Label horizontal content="Deemed Irrelevant" color="red" />}
        <p>{val.comments}</p>
      </div>}
  />

BaseMatchStatus.propTypes = {
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func,
}

const mapStatusDispatchToProps = {
  onSubmit: updateMmeSubmissionStatus,
}

const MatchStatus = connect(null, mapStatusDispatchToProps)(BaseMatchStatus)

const BaseSubmissionGeneVariants = ({ geneVariants, modalId, genesById, dispatch, ...listProps }) =>
  <List {...listProps}>
    {Object.entries(geneVariants.reduce((acc, variant) =>
      ({ ...acc, [variant.geneId]: [...(acc[variant.geneId] || []), variant] }), {}),
    ).map(([geneId, variants]) =>
      <List.Item key={geneId}>
        <ShowGeneModal gene={genesById[geneId]} modalId={modalId} />
        {variants.length > 0 && variants[0].pos &&
          <List.List>
            {variants.map(variant =>
              <List.Item key={variant.pos}>
                {variantSummary(variant)}
              </List.Item>,
            )}
          </List.List>
        }
      </List.Item>,
    )}
  </List>

BaseSubmissionGeneVariants.propTypes = {
  genesById: PropTypes.object,
  geneVariants: PropTypes.array,
  modalId: PropTypes.string,
  dispatch: PropTypes.func,
}

const mapGeneStateToProps = state => ({
  genesById: getGenesById(state),
})

const SubmissionGeneVariants = connect(mapGeneStateToProps)(BaseSubmissionGeneVariants)

const Phenotypes = ({ phenotypes, ...listProps }) =>
  <List {...listProps}>
    {phenotypes.map(phenotype =>
      <PhenotypeListItem key={phenotype.id} observed={phenotype.observed}>
        {phenotype.label} ({phenotype.id})
      </PhenotypeListItem>,
    )}
  </List>

Phenotypes.propTypes = {
  phenotypes: PropTypes.array,
}

const MATCH_FIELDS = {
  patient: {
    name: 'id',
    width: 2,
    content: 'Match',
    verticalAlign: 'top',
    format: (val) => {
      const patientFields = PATIENT_FIELDS.filter(k => val.patient[k])
      return patientFields.length ? <Popup
        header="Patient Details"
        trigger={<MatchContainer>{val.id} <Icon link name="info circle" /></MatchContainer>}
        content={patientFields.map(k => <div key={k}><b>{camelcaseToTitlecase(k)}:</b> {val.patient[k]}</div>)}
      /> : <MatchContainer>{val.id}</MatchContainer>
    },
  },
  contact: {
    name: 'contact',
    width: 3,
    content: 'Contact',
    verticalAlign: 'top',
    format: ({ patient }) => patient.contact &&
      <div>
        <div><b>{patient.contact.institution}</b></div>
        <div>{patient.contact.name}</div>
        <BreakWordLink href={patient.contact.href}>{patient.contact.href.replace('mailto:', '')}</BreakWordLink>
      </div>,
  },
  matchStatus: {
    name: 'comments',
    width: 4,
    content: 'Follow Up Status',
    verticalAlign: 'top',
    format: initialValues => <MatchStatus initialValues={initialValues} />,
  },
  description: {
    name: 'description',
    width: 3,
    content: 'External Description',
    verticalAlign: 'top',
  },
  id: {
    name: 'id',
    width: 3,
    content: 'External ID',
    verticalAlign: 'top',
    format: val => (val.id.match('OMIM') ?
      <a target="_blank" href={`https://www.omim.org/entry/${val.id.replace('OMIM:', '')}`}>{val.id}</a> : val.id),
  },
  geneVariants: {
    name: 'geneVariants',
    width: 2,
    content: 'Genes',
    verticalAlign: 'top',
    format: val => <SubmissionGeneVariants geneVariants={val.geneVariants} modalId={val.id} />,
  },
  score: {
    name: 'score',
    width: 1,
    content: 'Score',
    verticalAlign: 'top',
  },
  phenotypes: {
    name: 'phenotypes',
    width: 4,
    content: 'Phenotypes',
    verticalAlign: 'top',
    format: val => <Phenotypes phenotypes={val.phenotypes} bulleted />,
  },
  createdDate: {
    name: 'createdDate',
    width: 1,
    content: 'First Seen',
    verticalAlign: 'top',
    format: val => new Date(val.createdDate).toLocaleDateString(),
  },
}

const MME_RESULTS_KEY = 'mmeResultGuids'

const DISPLAY_FIELDS = {
  [MME_RESULTS_KEY]: [
    MATCH_FIELDS.patient,
    MATCH_FIELDS.createdDate,
    MATCH_FIELDS.contact,
    MATCH_FIELDS.geneVariants,
    MATCH_FIELDS.phenotypes,
    MATCH_FIELDS.matchStatus,
  ],
  // TODO monarch
  monarchResults: [
    MATCH_FIELDS.id,
    MATCH_FIELDS.description,
    MATCH_FIELDS.score,
    MATCH_FIELDS.genes,
    MATCH_FIELDS.phenotypes,
  ],
}

const BaseMatches = ({ resultsKey, individual, loading, mmeResultsByGuid }) => {
  // TODO monarch
  const matchResults = (individual[resultsKey] || []).map(resultGuid => ({
    ...mmeResultsByGuid[resultGuid].matchStatus,
    ...mmeResultsByGuid[resultGuid],
  }))

  return (
    <SortableTable
      basic="very"
      fixed
      idField="id"
      defaultSortColumn={resultsKey === MME_RESULTS_KEY ? 'createdDate' : 'id'}
      defaultSortDescending={resultsKey === MME_RESULTS_KEY}
      columns={DISPLAY_FIELDS[MME_RESULTS_KEY]}
      data={matchResults}
      loading={loading}
    />
  )
}

BaseMatches.propTypes = {
  resultsKey: PropTypes.string.isRequired,
  individual: PropTypes.object,
  mmeResultsByGuid: PropTypes.object,
  loading: PropTypes.bool,
}

const matchesMapStateToProps = state => ({
  mmeResultsByGuid: getMmeResultsByGuid(state),
})

const Matches = connect(matchesMapStateToProps)(BaseMatches)

const monarchDetailPanels = submission => [{
  title: { content: <b>Similar patients in the Monarch Initiative</b>, key: 'title' },
  content: { content: <Matches matchKey="monarchMatch" submission={submission} />, key: 'monarch' },
}]

const Matchmaker = ({ loading, load, searchMme, monarchLoading, loadMonarch, individuals, onSubmit, defaultMmeSubmissionsByIndividual }) =>
  individuals.filter(individual => individual.affected === AFFECTED).map(individual =>
    <div key={individual.individualGuid}>
      <Header size="medium" content={individual.individualId} dividing />
      {individual.mmeSubmittedData &&
        <Grid padded>
          <Grid.Row>
            <Grid.Column width={2}><b>Submitted Genotypes:</b></Grid.Column>
            <Grid.Column width={14}>
              {individual.mmeSubmittedData.geneVariants.length ?
                <SubmissionGeneVariants
                  geneVariants={individual.mmeSubmittedData.geneVariants}
                  modalId="submission"
                  horizontal
                /> : <i>None</i>}
            </Grid.Column>
          </Grid.Row>
          <Grid.Row>
            <Grid.Column width={2}><b>Submitted Phenotypes:</b></Grid.Column>
            <Grid.Column width={14}>
              {individual.mmeSubmittedData.phenotypes.length ?
                <Phenotypes phenotypes={individual.mmeSubmittedData.phenotypes} horizontal bulleted /> : <i>None</i>}
            </Grid.Column>
          </Grid.Row>
        </Grid>
      }
      {individual.mmeSubmittedDate ?
        <DataLoader contentId={individual.individualGuid} content load={load} loading={false}>
          <ButtonLink
            disabled={!individual.mmeResultGuids}
            onClick={searchMme(individual.individualGuid)}
            icon="search"
            labelPosition="right"
            content="Search for New Matches"
          />|<HorizontalSpacer width={10} />
          <ButtonLink
            disabled={!individual.mmeResultGuids}
            onClick={loadMonarch(individual.individualGuid)}
            icon="search"
            labelPosition="right"
            content="Search in the Monarch Initiative"
          />|<HorizontalSpacer width={10} />
          <UpdateButton
            disabled={!individual.mmeSubmittedData}
            buttonText="Update Submission"
            modalSize="large"
            modalTitle={`Update Submission for ${individual.individualId}`}
            modalId={`${individual.individualGuid}_-_updateMmeSubmission`}
            confirmDialog="Are you sure you want to update this submission?"
            initialValues={individual.mmeSubmittedData}
            formFields={SUBMISSION_EDIT_FIELDS}
            onSubmit={onSubmit(individual.individualGuid)}
            showErrorPanel
          />|<HorizontalSpacer width={10} />
          <DeleteButton
            disabled={!individual.mmeSubmittedData}
            onSubmit={onSubmit(individual.individualGuid)}
            buttonText="Delete Submission"
            confirmDialog="Are you sure you want to remove this patient from the Matchmaker Exchange"
          />
          <DataLoader content={individual.monarchResults} loading={monarchLoading} hideError>
            <Accordion defaultActiveIndex={0} panels={monarchDetailPanels(individual)} />
          </DataLoader>
          <Matches resultsKey={MME_RESULTS_KEY} individual={individual} loading={loading} />
        </DataLoader> :
        <div>
          <Header
            size="small"
            content="This individual has no submissions"
            icon={<Icon name="warning sign" color="orange" />}
            subheader={
              <div className="sub header">
                <UpdateButton
                  initialValues={defaultMmeSubmissionsByIndividual[individual.individualGuid]}
                  buttonText="Submit to Matchmaker"
                  editIconName=" "
                  modalSize="large"
                  modalTitle={`Create Submission for ${individual.individualId}`}
                  modalId={`${individual.individualGuid}_-_createMmeSubmission`}
                  confirmDialog="Are you sure you want to submit this individual?"
                  formFields={SUBMISSION_EDIT_FIELDS}
                  onSubmit={onSubmit(individual.individualGuid)}
                  showErrorPanel
                />
              </div>}
          />
          <VerticalSpacer height={10} />
        </div>}
    </div>,
  )

Matchmaker.propTypes = {
  individuals: PropTypes.array,
  loading: PropTypes.bool,
  load: PropTypes.func,
  monarchLoading: PropTypes.bool,
  loadMonarch: PropTypes.func,
  searchMme: PropTypes.func,
  onSubmit: PropTypes.func,
  defaultMmeSubmissionsByIndividual: PropTypes.object,
}

const mapStateToProps = (state, ownProps) => ({
  individuals: getSortedIndividualsByFamily(state)[ownProps.match.params.familyGuid],
  loading: getMatchmakerMatchesLoading(state),
  monarchLoading: getMonarchMatchesLoading(state),
  defaultMmeSubmissionsByIndividual: getDefaultMmeSubmissionByIndividual(state, ownProps),
})

const mapDispatchToProps = (dispatch) => {
  return {
    load: (individualId) => {
      return dispatch(loadMmeMatches(individualId))
    },
    searchMme: individualId => () => {
      return dispatch(loadMmeMatches(individualId, 'mme'))
    },
    loadMonarch: individualId => () => {
      return dispatch(loadMmeMatches(individualId, 'monarch'))
    },
    onSubmit: individualGuid => (values) => {
      return dispatch(updateMmeSubmission({ ...values, individualGuid }))
    },
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Matchmaker)

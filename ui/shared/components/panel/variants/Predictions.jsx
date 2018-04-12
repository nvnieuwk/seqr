import React from 'react'
import PropTypes from 'prop-types'
import { Icon } from 'semantic-ui-react'


const SEVERITY_MAP = {
  damaging: 'red',
  probably_damaging: 'red',
  disease_causing: 'red',
  possibly_damaging: 'yellow',
  benign: 'green',
  tolerated: 'green',
  polymorphism: 'green',
}

const Prediction = ({ title, field, annotation, dangerThreshold, warningThreshold }) => {
  let value = annotation[field]
  if (!value) {
    return null
  }

  let color
  if (dangerThreshold) {
    value = parseFloat(value).toPrecision(2)
    if (value >= dangerThreshold) {
      color = 'red'
    } else if (value >= warningThreshold) {
      color = 'yellow'
    } else {
      color = 'green'
    }
  } else {
    color = SEVERITY_MAP[value]
    value = value.replace('_', ' ')
  }

  title = title || field.replace('_', ' ').toUpperCase()
  return <div><Icon name="circle" color={color} /><b>{title} </b>{value}</div>
}

Prediction.propTypes = {
  field: PropTypes.string.isRequired,
  annotation: PropTypes.object,
  title: PropTypes.string,
  dangerThreshold: PropTypes.number,
  warningThreshold: PropTypes.number,
}


const Predictions = ({ annotation }) => {
  return annotation ?
    <div>
      <Prediction field="polyphen" annotation={annotation} />
      <Prediction field="sift" annotation={annotation} />
      <Prediction field="muttaster" annotation={annotation} title="MUT TASTER" />
      <Prediction field="fathmm" annotation={annotation} />
      <Prediction field="cadd_phred" annotation={annotation} dangerThreshold={20} warningThreshold={10} />
      <Prediction field="dann_score" annotation={annotation} dangerThreshold={0.96} warningThreshold={0.93} />
      <Prediction field="revel_score" annotation={annotation} dangerThreshold={0.75} warningThreshold={0.5} />
      <Prediction field="mpc_score" annotation={annotation} dangerThreshold={2} warningThreshold={1} />
    </div>
    : null
}

Predictions.propTypes = {
  annotation: PropTypes.object,
}

export default Predictions

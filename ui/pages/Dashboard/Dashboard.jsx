import 'react-hot-loader/patch'
import React from 'react'
import DocumentTitle from 'react-document-title'
import { Divider } from 'semantic-ui-react'

import ProjectsTable from './components/ProjectsTable'
// import AddOrEditProjectModal from './components/table-body/AddOrEditProjectModal'
// import EditProjectCategoriesModal from './components/table-body/EditProjectCategoriesModal'


//<AddOrEditProjectModal />
//<EditProjectCategoriesModal />
const Dashboard = () => {
  return (
    <div>
      <DocumentTitle title="seqr: home" />
      <div style={{ textAlign: 'center', fontSize: '16px', fontWeight: 400, fontStyle: 'italic' }}>
         Welcome to the new seqr dashboard. The previous version can be found <a href="/projects">here</a>.
      </div>
      <Divider />
      <ProjectsTable />
    </div>
  )
}

export default Dashboard

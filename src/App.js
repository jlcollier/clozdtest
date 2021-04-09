import React, { Component } from 'react';
import ReactDOMServer from 'react-dom/server';
import ClipLoader from "react-spinners/ClipLoader";
import axios from 'axios';
import './App.css';

const PATH_BASE = 'https://randomuser.me/api/';
const PARAM_FIELDS_CSV_LIST = 'inc=';
const PARAM_RESULT_QUANTITY = 'results=';
const PARAM_USER_SEED = 'seed=';
const PARAM_PAGE = 'page=';
const PARAM_MINIMAL_INFO = 'noinfo';

const FIELDS_CSV_LIST = 'name,email,location,picture,phone,cell,dob';
const USER_SEED = 'abc';

const MAX_USERS_PER_FETCH = 5000; // how many users the API will give us at a time, max
const USERS_DESIRED = 7000;       // how many users we need for our app

class App extends Component {

  constructor(props) {
    super(props);

    this.state = {
      filterTerm: '',
      error: null,
    }

    this.onFilterChange = this.onFilterChange.bind(this);
    this.onError = this.onError.bind(this);
  }

  onFilterChange(filterTerm) {
    this.setState({ filterTerm: filterTerm });
  }

  onError(error) {
    this.setState({ error })
  }

  render() {
    const {
      filterTerm,
      error,
    } = this.state;

    return (
      <div className="page">
        { error
          ? <div className="error">
            <p>Something went wrong. Please refresh the page.</p>
          </div>
          : <div>
            <Search
              triggerFilter={this.onFilterChange}
            >
              Filter results by either first or last name:
            </Search>
            <UserDisplay
              filterTerm={filterTerm}
              onError={this.onError}
            />
          </div>
        }
      </div>
    );
  }
}

class Search extends Component {

  constructor(props) {
    super(props);

    this.state = {
      value: '',
      placeholder: '',
    }

    this.onValueChange = this.onValueChange.bind(this);
    this.onButtonClick = this.onButtonClick.bind(this);
  }

  onValueChange(event) {
    let value = event.target.value;
    this.setState({ value: value });
  }

  onButtonClick() {
    if (this.state.value === '') {
      this.setState({ placeholder: ''});
    } else {
      this.setState({ placeholder: 'Show All Users'});
    }

    this.props.triggerFilter(this.state.value);
  }

  render() {
    const {
      value,
      placeholder,
    } = this.state;

    return (
      <div className="filter">
        <div className="filter-title">
          {this.props.children}
        </div>
        <input
          placeholder={placeholder}
          type="text"
          onChange={this.onValueChange}
          value={value}
        />
        <Button
          onClick={this.onButtonClick}
        >
          Filter
        </Button>
      </div>
    );
  }
}

const Button = ({
  onClick,
  children,
}) =>
  <button
    onClick={onClick}
    className="button"
    type="button"
  >
    {children}
  </button>

class UserDisplay extends Component {

  constructor(props) {
    super(props);

    this.state = {
      users: null,
      displayedUsers: null,
      displayTable: false,
      filterTerm: this.props.filterTerm,
    }

    this.fetchUsers = this.fetchUsers.bind(this);
    this.setUsers = this.setUsers.bind(this);
    this.onMoreInfo = this.onMoreInfo.bind(this);
    this.onFilterChange = this.onFilterChange.bind(this);
  }

  componentDidMount() {
    this.fetchUsers();
  }

  componentDidUpdate(prevProps) {
    if (this.props.filterTerm !== prevProps.filterTerm) {
      this.onFilterChange(this.props.filterTerm);
    }
  }

  // Ideally, the back-end would allow me to get all users on a single request...
  //   but as the API allows me to get a max of MAX_USERS_PER_FETCH users, and I need USERS_DESIRED,
  //   I may need to do more than one fetch. This is a little awkward, but given the situation and
  //   how I wanted to implement this page (all users at once, alphebetized), I
  //   feel like this function and determineFetches() implement the best solution.
  fetchUsers() {

    const fetchQuantityTuple = determineFetches(USERS_DESIRED, MAX_USERS_PER_FETCH);
    const apiRequestQuantity = fetchQuantityTuple[0];
    const usersPerFetch = fetchQuantityTuple[1];
    const extraUserQuantity = fetchQuantityTuple[2];

    const promiseCatcher = [];

    for (let i = 0; i < apiRequestQuantity; i++) {
      let extra = 0;

      if (i === 0) {
        extra = extraUserQuantity;
      }

      const fetchUrl = PATH_BASE +
        '?' + PARAM_FIELDS_CSV_LIST + FIELDS_CSV_LIST +
        '&' + PARAM_RESULT_QUANTITY + (usersPerFetch - extra) +
        '&' + PARAM_USER_SEED + USER_SEED +
        '&' + PARAM_PAGE + (i + 1) +
        '&' + PARAM_MINIMAL_INFO;

      promiseCatcher.push(axios(fetchUrl));
    }

    Promise.all(promiseCatcher)
      .then(responses => this.setUsers(responses))
      .catch(error => this.props.onError(error));
  }

  setUsers(responses) {

    let consolidatedResults = responses[0].data.results;

    for (let i = 1; i < responses.length; i++) {
      const currentResult = responses[i].data.results;
      consolidatedResults = consolidatedResults.concat(currentResult);
    }

    consolidatedResults.sort((a, b) => {
      const textA = a.name.first;
      const textB = b.name.first;
      return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
    });

    this.setState({
      users: consolidatedResults,
      displayedUsers: consolidatedResults,
      displayTable: true,
    });
  }

  onMoreInfo(user) {
    const dob = new Date(user.dob.date);
    const formattedDob = dob.toLocaleString('default', { month: 'short' }) + ' '
      + dob.getDate() + ', '
      + dob.getFullYear();

    const newWindow = window.open();

    newWindow.document.write('<title>' + user.name.first + ' ' + user.name.last + '</title>');
    newWindow.document.write(
      ReactDOMServer.renderToStaticMarkup(
        moreUserInfoPage(user, formattedDob)
      )
    );

    newWindow.document.close();
  }

  onFilterChange(term) {

    term = term.toLowerCase();

    const filteredArray = this.state.users.filter((user) => {
      const first = user.name.first.toLowerCase();
      const last = user.name.last.toLowerCase();

      if (first.includes(term) || last.includes(term)) {
        return true;
      } else {
        return false;
      }
    });

    this.setState({ displayedUsers: filteredArray, filterTerm: term });
  }

  render() {
    const {
      displayTable,
      displayedUsers,
    } = this.state;

    const list = displayedUsers || [];

    return (
      <div>
        { displayTable
          ? <div className="table">
            {list.map((user,index) =>
              <div
                key={index}
                className="table-row"
                onClick={() => this.onMoreInfo(user)}
              >
                <span style={{ width: '40%' }}>
                  {user.name.first + ' ' + user.name.last}
                </span>
                <span style={{ width: '40%' }}>
                  {user.email}
                </span>
                <span style={{ width: '20%' }}>
                  {user.location.city + ', ' + user.location.country}
                </span>
              </div>
            )}
          </div>
          : <div className="spinner">
            <ClipLoader
              loading={!displayTable}
              size={150}
            />
          </div>
        }
      </div>
    );
  }
}

// be wary of excluding address unit numbers from the full address:
//   to my knowledge, the API doesn't have unit numbers available
const moreUserInfoPage = (user, formattedDob) =>
  <div>
    <div>
      <img src={user.picture.large} alt="User Profile"/>
    </div>
    <div>
      <b>Name:</b><br/>
      <div>
        {user.name.first} {user.name.last}
      </div>
    </div>
    <div>
      <b>Email:</b><br/>
      <div>
        {user.email}
      </div>
    </div>
    <div>
      <b>Address:</b><br/>
      <div>
        {user.location.street.number} {user.location.street.name}<br/>
        {user.location.city}, {user.location.state} {user.location.postcode}<br/>
        {user.location.country}
      </div>
    </div>
    <div>
      <b>Phone:</b><br/>
      <div>
        Main: {user.phone}<br/>
        Cell: {user.cell}
      </div>
    </div>
    <div>
      <b>Date of Birth:</b><br/>
      <div>
        {formattedDob}
      </div>
    </div>
  </div>

// determineFetches() was made in the case of an API not allowing
//   as much data in one fetch as we would like, thus,
// accepts two integer numbers:
// (1) how many results we want from the API
// (2) the API's max amount of results per request
// returns: a triple-value array of intergers:
// (1) how many fetches should be run
// (2) how many results should in each fetch
// (3) how many extra results we will get if we run (1)*(2) fetches,
//     which will always be less than (2)
function determineFetches(usersDesired, fetchMaximum) {
  let factor;
  let apiRequestQuantity;
  let extraUserQuantity;

  if (usersDesired <= fetchMaximum) {
    factor = 1;
    apiRequestQuantity = usersDesired;
    extraUserQuantity = 0;
  } else if (usersDesired % fetchMaximum === 0) {
    factor = usersDesired / fetchMaximum;
    apiRequestQuantity = fetchMaximum;
    extraUserQuantity = 0;
  } else {
    factor = Math.trunc(usersDesired / fetchMaximum) + 1;
    apiRequestQuantity = Math.ceil(usersDesired / factor);
    extraUserQuantity = apiRequestQuantity*factor - usersDesired;
  }

  return [factor, apiRequestQuantity, extraUserQuantity];
}

export default App;

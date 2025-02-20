import React, { useState, useEffect } from 'react';
import _ from 'lodash'
import FuzzySearch from 'fuzzy-search'
import { Bech32 } from '@cosmjs/encoding'

import { format, add } from 'mathjs'

import Coins from "./Coins";
import ClaimRewards from "./ClaimRewards";
import RevokeRestake from "./RevokeRestake";
import ValidatorImage from './ValidatorImage'
import TooltipIcon from './TooltipIcon'

import {
  Table,
  Button,
  Spinner,
  Dropdown, 
  OverlayTrigger, 
  Tooltip,
  Nav
} from 'react-bootstrap'
import { FilterSquare, XCircle } from "react-bootstrap-icons";

import ValidatorName from "./ValidatorName";
import ManageRestake from "./ManageRestake";

function Validators(props) {
  const { address, network, validators, operators, delegations, operatorGrants } = props

  const [filter, setFilter] = useState({keywords: '', status: 'active', group: 'delegated'})
  const [results, setResults] = useState([])

  useEffect(() => {
    let filtered = filteredValidators(validators, filter)
    let group = filter.group
    while(filtered.length < 1 && group !== 'all'){
      group = group === 'delegated' ? 'operators' : 'all'
      filtered = filteredValidators(validators, {...filter, group})
      if(filtered.length > 0 || group === 'all'){
        return setFilter({ ...filter, group })
      }
    }
    setResults(filtered)
  }, [validators, operators, delegations, operatorGrants, filter]);

  function sortValidators(validators){
    validators = _.sortBy(validators, ({ operator_address: address }) => {
      const delegation = delegations && delegations[address]
      return 0 - (delegation?.balance?.amount || 0)
    });
    return _.sortBy(validators, ({ operator_address: address }) => {
      if(network.data.ownerAddress === address) return -5

      const delegation = delegations && delegations[address]
      const operator = operators && operators.find(el => el.address === address)

      if (delegation) {
        return operator ? -2 : -1
      } else {
        return operator ? 0 : 1
      }
    });
  }

  function filterValidators(event){
    setFilter({...filter, keywords: event.target.value})
  }

  function filteredValidators(validators, filter){
    let searchResults
    if (props.exclude){
      searchResults = Object.values(_.omit(validators, props.exclude))
    }else{
      searchResults = Object.values(validators)
    }
    const { keywords, status, group } = filter

    if(status){
      searchResults = searchResults.filter(result => {
        if (status === 'active') {
          return result.status === 'BOND_STATUS_BONDED'
        } else if (status === 'inactive') {
          return result.status !== 'BOND_STATUS_BONDED'
        } else {
          return true
        }
      })
    }

    searchResults = filterByGroup(searchResults, group)

    if (!keywords || keywords === '') return sortValidators(searchResults)

    const searcher = new FuzzySearch(
      searchResults, ['description.moniker'],
      { sort: true }
    )

    return searcher.search(keywords)
  }

  function filterByGroup(validators, group){
    switch (group) {
      case 'delegated':
        validators = validators.filter(({operator_address: address}) => {
          return delegations && delegations[address]
        })
        break;
      case 'operators':
        validators = validators.filter(({operator_address: address}) => {
          return operators && operators.find(el => el.address === address)
        })
        break;
    }
    return validators
  }

  function isValidatorOperator(validator) {
    if (!address || !validator || !window.atob) return false;

    const prefix = network.prefix
    const validatorOperator = Bech32.encode(prefix, Bech32.decode(validator.operator_address).data)
    return validatorOperator === address
  }

  function operatorForValidator(validatorAddress) {
    return operators.find((el) => el.address === validatorAddress);
  }

  function renderValidator(validator) {
    const validatorAddress = validator.operator_address
    const delegation = delegations[validatorAddress];
    const validatorOperator = isValidatorOperator(validator)
    const rewards =
      props.rewards && props.rewards[validatorAddress];
    const denomRewards = rewards && rewards.reward.find(
      (reward) => reward.denom === network.denom
    );
    const operator = operatorForValidator(validatorAddress);
    const grants = operator && operatorGrants[operator.botAddress]

    let rowVariant
    if (validatorOperator) rowVariant = 'table-info'

    const delegationBalance = (delegation && delegation.balance) || {
      amount: 0,
      denom: network.denom,
    };

    const minimumReward = operator && {
      amount: operator.minimumReward,
      denom: network.denom,
    };

    return (
      <tr key={validatorAddress} className={rowVariant}>
        <td>{validator.rank || '-'}</td>
        <td width={30}>
          <ValidatorImage
            validator={validator}
            width={30}
            height={30}
          />
        </td>
        <td>
          <span role="button" onClick={() => props.showValidator(validator, { activeTab: 'profile' })}>
            <ValidatorName validator={validator} />
          </span>
        </td>
        <td className="text-center">
          <ManageRestake
            size="sm"
            network={network}
            validator={validator}
            operator={operator}
            grants={grants}
            delegation={delegation}
            authzSupport={props.authzSupport}
            restakePossible={props.restakePossible}
            openGrants={() => props.showValidator(validator, { activeTab: 'restake' })}
          />
        </td>
        <td className="d-none d-lg-table-cell text-center">
          {operator && (
            <span role="button" onClick={() => props.showValidator(validator, { activeTab: 'restake' })}>
              <TooltipIcon
                icon={<small className="text-decoration-underline">{operator.frequency()}</small>}
                identifier={operator.address}
              >
                <div className="mt-2 text-center">
                  <p>REStakes {operator.runTimesString()}</p>
                  <p>
                    Minimum reward is{" "}
                    <Coins
                      coins={minimumReward}
                      decimals={network.decimals}
                      fullPrecision={true}
                    />
                  </p>
                </div>
              </TooltipIcon>
            </span>
          )}
        </td>
        {network.apyEnabled !== false && (
          <td className="d-none d-lg-table-cell text-center">
            {Object.keys(props.validatorApy).length > 0
              ? props.validatorApy[validatorAddress]
                ? <small>{Math.round(props.validatorApy[validatorAddress] * 100) + "%"}</small>
                : "-"
              : (
                <Spinner animation="border" role="status" className="spinner-border-sm text-secondary">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              )}
          </td>
        )}
        <td className="d-none d-lg-table-cell text-center">
          <small>{format(validator.commission.commission_rates.rate * 100, 2)}%</small>
        </td>
        <td className="d-none d-sm-table-cell">
          <small>
            <Coins
              coins={delegationBalance}
              decimals={network.decimals}
            />
          </small>
        </td>
        {!props.modal && (
          <td className="d-none d-md-table-cell">
            {denomRewards && (
              <small>
                <Coins
                  key={denomRewards.denom}
                  coins={denomRewards}
                  decimals={network.decimals}
                />
              </small>
            )}
          </td>
        )}
        <td>
          <div className="d-grid gap-2 d-md-flex justify-content-end">
            {props.manageButton ? (
              <Button size="sm" onClick={() => props.showValidator(validator, {activeTab: 'delegate'})}>
                {props.manageButton}
              </Button>
            ) : !props.validatorLoading[validatorAddress] ? (
              delegation ? (
                <Dropdown>
                  <Dropdown.Toggle
                    variant="secondary"
                    size="sm"
                    id="dropdown-basic"
                  >
                    Manage
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {operator &&
                      props.restakePossible && (
                        <>
                          <Dropdown.Item onClick={() => props.showValidator(validator, { activeTab: 'restake' })}>
                            {grants.grantsValid ? 'Manage REStake' : 'Enable REStake'}
                          </Dropdown.Item>
                          {grants.grantsExist && (
                            <RevokeRestake
                              address={props.address}
                              operator={operator}
                              grants={grants}
                              stargateClient={props.stargateClient}
                              onRevoke={props.onRevoke}
                              setLoading={(loading) =>
                                props.setValidatorLoading(
                                  validatorAddress,
                                  loading
                                )
                              }
                              setError={props.setError}
                            />
                          )}
                          <hr />
                        </>
                      )}
                    <ClaimRewards
                      network={network}
                      address={address}
                      validatorRewards={props.validatorRewards([validatorAddress])}
                      stargateClient={props.stargateClient}
                      onClaimRewards={props.onClaimRewards}
                      setLoading={(loading) =>
                        props.setValidatorLoading(validatorAddress, loading)
                      }
                      setError={props.setError}
                    />
                    <ClaimRewards
                      restake={true}
                      network={network}
                      address={address}
                      validatorRewards={props.validatorRewards([validatorAddress])}
                      stargateClient={props.stargateClient}
                      onClaimRewards={props.onClaimRewards}
                      setLoading={(loading) =>
                        props.setValidatorLoading(validatorAddress, loading)
                      }
                      setError={props.setError}
                    />
                    {validatorOperator && (
                      <>
                        <hr />
                        <ClaimRewards
                          commission={true}
                          network={network}
                          address={address}
                          validatorRewards={props.validatorRewards([validatorAddress])}
                          stargateClient={props.stargateClient}
                          onClaimRewards={props.onClaimRewards}
                          setLoading={(loading) =>
                            props.setValidatorLoading(validatorAddress, loading)
                          }
                          setError={props.setError}
                        />
                      </>
                    )}
                    <hr />
                    <Dropdown.Item onClick={() => props.showValidator(validator, { activeTab: 'delegate' })}>
                      Delegate
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => props.showValidator(validator, { redelegate: true })}>
                      Redelegate
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => props.showValidator(validator, { undelegate: true })}>
                      Undelegate
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <OverlayTrigger
                  placement="top"
                  overlay={
                    <Tooltip id={`tooltip-${validatorAddress}`}>
                      Delegate to enable REStake
                    </Tooltip>
                  }
                >
                  <Button variant="primary" size="sm" onClick={() => props.showValidator(validator, { activeTab: 'delegate' })}>
                    Delegate
                  </Button>
                </OverlayTrigger>
              )
            ) : (
              <Button className="btn-sm btn-secondary mr-5" disabled>
                <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
                &nbsp;
              </Button>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <div className="d-flex flex-wrap justify-content-center align-items-center mb-3">
        <div className="flex-fill">
          <div className="input-group">
            <input className="form-control border-right-0 border" onChange={filterValidators} value={filter.keywords} type="text" placeholder="Search.." style={{maxWidth: 150}} />
            <span className="input-group-append">
              <button className="btn btn-light text-dark border-left-0 border" type="button" onClick={() => setFilter({...filter, keywords: ''})}>
                <XCircle />
              </button>
            </span>
          </div>
        </div>
        <div className={`${!props.modal && 'd-lg-flex'} d-none position-absolute mx-auto justify-content-center align-self-center`}>
          <Nav fill variant="pills" activeKey={filter.group} className={`flex-row${props.modal ? ' small' : ''}`} onSelect={(e) => setFilter({...filter, group: e})}>
            <Nav.Item>
              <Nav.Link eventKey="delegated" disabled={filteredValidators(validators, {...filter, group: 'delegated'}).length < 1}>My Delegations</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="operators" disabled={filteredValidators(validators, {...filter, group: 'operators'}).length < 1}>REStake Operators</Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="all">All Validators</Nav.Link>
            </Nav.Item>
          </Nav>
        </div>
        <div className={`d-flex ${!props.modal && 'd-lg-none'} justify-content-center`}>
          <select className="form-select w-auto h-auto" aria-label="Delegation group" value={filter.group} onChange={(e) => setFilter({...filter, group: e.target.value})}>
            <option value="delegated">My Delegations</option>
            <option value="operators">REStake Operators</option>
            <option value="all">All</option>
          </select>
        </div>
        <div className="flex-fill d-flex justify-content-end">
          <select className="form-select w-auto h-auto" aria-label="Validator status" value={filter.status} onChange={(e) => setFilter({...filter, status: e.target.value})}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
          {/* <FilterSquare size={30} className="ms-3" /> */}
        </div>
      </div>
      {results.length > 0 &&
        <Table className="align-middle table-striped">
          <thead>
            <tr>
              <th>#</th>
              <th colSpan={2}>Validator</th>
              <th className="d-none d-sm-table-cell text-center">REStake</th>
              <th className="d-sm-none"></th>
              <th className="d-none d-lg-table-cell text-center">
                Frequency
              </th>
              {network.apyEnabled !== false && (
                <th className="d-none d-lg-table-cell text-center">
                  <TooltipIcon
                    icon={<span className="text-decoration-underline">APY</span>}
                    identifier="delegations-apy"
                  >
                    <div className="mt-2 text-center">
                      <p>Based on commission, compounding frequency and estimated block times.</p>
                      <p>This is a best case scenario and may not be 100% accurate.</p>
                    </div>
                  </TooltipIcon>
                </th>
              )}
              <th className="d-none d-lg-table-cell text-center">Fee</th>
              <th className="d-none d-sm-table-cell">Delegation</th>
              {!props.modal && (
                <th className="d-none d-md-table-cell">Rewards</th>
              )}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {results.map(item => renderValidator(item))}
          </tbody>
          <tfoot>
            <tr>
              <td></td>
              <td colSpan={2}></td>
              <td className="d-none d-sm-table-cell text-center"></td>
              <td className="d-sm-none"></td>
              <td className="d-none d-lg-table-cell text-center"></td>
              {network.apyEnabled !== false && (
                <td className="d-none d-lg-table-cell text-center"></td>
              )}
              <td className="d-none d-lg-table-cell"></td>
              <td className="d-none d-sm-table-cell">
                <strong className="small">
                  <Coins
                    coins={{
                      amount: results.reduce((sum, result) => {
                        const delegation = delegations[result.operator_address]
                        if(!delegation) return sum

                        return add(sum, delegation.balance.amount)
                      }, 0),
                      denom: network.denom
                    }}
                    decimals={network.decimals} />
                </strong>
              </td>
              {!props.modal && (
                <td className="d-none d-sm-table-cell">
                  {props.rewards && (
                    <strong className="small">
                      <Coins
                        coins={{
                          amount: results.reduce((sum, result) => {
                            const reward = props.rewards[result.operator_address]?.reward?.find(el => el.denom === network.denom)
                            if (!reward) return sum

                            return add(sum, reward.amount)
                          }, 0),
                          denom: network.denom
                        }}
                        decimals={network.decimals} />
                    </strong>
                  )}
                </td>
              )}
              <td></td>
            </tr>
          </tfoot>
        </Table>
      }
      {results.length < 1 &&
        <p className="text-center my-5"><em>No validators found</em></p>
      }
    </>
  )
}

export default Validators;

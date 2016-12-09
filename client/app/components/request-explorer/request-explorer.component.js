(function() {
  'use strict';

  angular.module('app.components')
    .component('requestExplorer', {
      templateUrl: 'app/components/request-explorer/request-explorer.html',
      controller: ComponentController,
      controllerAs: 'vm',
    });

  /** @ngInject */
  function ComponentController($state, CollectionsApi, RequestsState, ListView, $filter, lodash, Language, EventNotifications) {
    var vm = this;

    vm.$onInit = function() {
      vm.listData = [];
      vm.listDataCopy = [];
      vm.loading = true;

      fetchData();

      angular.extend(vm, {
        listConfig: {
          selectItems: false,
          showSelectBox: false,
          selectionMatchProp: 'id',
          onClick: handleRequestClick,
        },
        toolbarConfig: {
          filterConfig: {
            fields: getRequestFilterFields(),
            resultsCount: vm.listDataCopy.length,
            appliedFilters: RequestsState.filterApplied ? RequestsState.getFilters() : [],
            onFilterChange: filterChange,
          },
          sortConfig: {
            fields: getRequestSortFields(),
            onSortChange: sortChange,
            isAscending: RequestsState.getSort().isAscending,
            currentField: RequestsState.getSort().currentField,
          },
        },

      });

      if (RequestsState.filterApplied) {
        /* Apply the filtering to the data list */
        filterChange(RequestsState.getFilters());
        RequestsState.filterApplied = false;
      } else {
        applyFilters();
      }

      Language.fixState(RequestsState, vm.toolbarConfig);
    };

    // Private

    function fetchData() {
      var attributes = ['picture', 'picture.image_href', 'approval_state', 'created_on', 'description', 'requester_name'];
      var filterValues = [];
      var options = {expand: 'resources', attributes: attributes, filter: filterValues};

      CollectionsApi.query('requests', options).then(handleSuccess, handleError);

      function handleSuccess(response) {
        vm.listData = response.resources;
        vm.listDataCopy = angular.copy(vm.listData);
        vm.loading = false;
      }

      function handleError() {
        vm.loading = false;
        EventNotifications.error(__('There was an error loading the requests.'));
      }
    }

    function getRequestFilterFields() {
      var statuses = [__('Pending'), __('Denied'), __('Approved')];

      return [
        ListView.createFilterField('description', __('Description'), __('Filter by Description'), 'text'),
        ListView.createFilterField('request_id', __('Request ID'), __('Filter by Request ID'), 'text'),
        ListView.createFilterField('requester_name', __('Requester'), __('Filter by Requester'), 'text'),
        ListView.createFilterField('request_date', __('Request Date'), __('Filter by Request Date'), 'text'),
        ListView.createFilterField('approval_state', __('Request Status'), __('Filter by Status'), 'select', statuses),
      ];
    }

    function getRequestSortFields() {
      return [
        ListView.createSortField('description', __('Description'), 'alpha'),
        ListView.createSortField('id', __('Request ID'), 'numeric'),
        ListView.createSortField('requester_name', __('Requester'), 'alpha'),
        ListView.createSortField('requested', __('Request Date'), 'numeric'),
        ListView.createSortField('status', __('Request Status'), 'alpha'),
      ];
    }

    function handleRequestClick(item, _e) {
      $state.go('services.requests.details', {requestId: item.id});
    }

    function sortChange(sortId, direction) {
      vm.listDataCopy.sort(compareFn);

      /* Keep track of the current sorting state */
      RequestsState.setSort(sortId, vm.toolbarConfig.sortConfig.isAscending);
    }

    function compareFn(item1, item2) {
      var compValue = 0;
      if (vm.toolbarConfig.sortConfig.currentField.id === 'description') {
        compValue = item1.description.localeCompare(item2.description);
      } else if (vm.toolbarConfig.sortConfig.currentField.id === 'id') {
        compValue = item1.id - item2.id;
      } else if (vm.toolbarConfig.sortConfig.currentField.id === 'requester_name') {
        compValue = item1.requester_name.localeCompare(item2.requester_name);
      } else if (vm.toolbarConfig.sortConfig.currentField.id === 'requested') {
        compValue = new Date(item1.created_on) - new Date(item2.created_on);
      } else if (vm.toolbarConfig.sortConfig.currentField.id === 'status') {
        compValue = item1.approval_state.localeCompare(item2.approval_state);
      }

      if (!vm.toolbarConfig.sortConfig.isAscending) {
        compValue = compValue * -1;
      }

      return compValue;
    }

    function filterChange(filters) {
      applyFilters(filters);
      vm.toolbarConfig.filterConfig.resultsCount = vm.listDataCopy.length;
    }

    function applyFilters(filters) {
      vm.listDataCopy = ListView.applyFilters(filters, vm.listDataCopy, vm.listData, RequestsState, requestMatchesFilter);

      /* Make sure sorting direction is maintained */
      sortChange(RequestsState.getSort().currentField, RequestsState.getSort().isAscending);
    }

    function requestMatchesFilter(item, filter) {
      if (filter.id === 'description') {
        return item.description.toLowerCase().indexOf(filter.value.toLowerCase()) !== -1;
      } else if (filter.id === 'approval_state') {
        var value;
        if (lodash.lastIndexOf([__('Pending'), 'Pending'], filter.value) > -1) {
          value = "pending_approval";
        } else if (lodash.lastIndexOf([__('Denied'), 'Denied'], filter.value) > -1) {
          value = "denied";
        } else if (lodash.lastIndexOf([__('Approved'), 'Approved'], filter.value) > -1) {
          value = "approved";
        }

        return item.approval_state === value;
      } else if (filter.id === 'request_id') {
        return String(item.id).toLowerCase().indexOf(filter.value.toLowerCase()) !== -1;
      } else if (filter.id === 'requester_name') {
        return String(item.requester_name).toLowerCase().indexOf(filter.value.toLowerCase()) !== -1;
      } else if (filter.id === 'request_date') {
        return $filter('date')(item.created_on).toLowerCase().indexOf(filter.value.toLowerCase()) !== -1;
      }

      return false;
    }
  }
})();

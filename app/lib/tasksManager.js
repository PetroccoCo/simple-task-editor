import Task from "../models/Task";
import ComponentManager from 'sn-components-api';

let TaskDelimitter = "\n";

export default class TasksManager {

  /* Singleton */
  static instance = null;
  static get() {
    if (this.instance == null) { this.instance = new TasksManager(); }
    return this.instance;
  }

  constructor() {
    this.initiateBridge();
  }

  initiateBridge() {
    var permissions = [
      {
        name: "stream-context-item"
      }
    ]

    this.componentManager = new ComponentManager(permissions, function(){
      // on ready
    });

    this.componentManager.streamContextItem((note) => {
      this.note = note;

      if(note.isMetadataUpdate) {
        return;
      }

      this.dataString = note.content.text;
      this.reloadData();
      this.dataChangeHandler && this.dataChangeHandler(this.tasks);
    });
  }

  isMobile() {
    return this.componentManager.environment == "mobile";
  }

  setDataChangeHandler(handler) {
    this.dataChangeHandler = handler;
  }

  parseRawTasksString(string) {
    if(!string) {string = ''}
    var allTasks = string.split(TaskDelimitter);
    var openTasks = [], completedTasks = [];
    return allTasks.filter((s) => {return s.replace(/ /g, '').length > 0}).map((rawString) => {
      return this.createTask(rawString);
    });
  }

  keyForTask(task) {
    return this.tasks.indexOf(task) + task.rawString;
  }

  reloadData() {
    this.tasks = this.parseRawTasksString(this.dataString);
  }

  getTasks() {
    if(!this.tasks) {
      this.reloadData();
    }
    return this.tasks;
  }

  createTask(rawString) {
    return new Task(rawString);
  }

  addTask(task) {
    this.tasks.unshift(task);
    this.save();
    this.reloadData();
  }

  completedTasks() {
    return this.tasks.filter((task) => {return task.completed == true})
  }

  removeTasks(tasks) {
    this.tasks = this.tasks.filter((task) => {
      return !tasks.includes(task);
    })
  }

  // Splits into completed and non completed piles, and organizes them into an ordered array
  splitTasks() {
    var tasks = this.getTasks();
    var openTasks = [], completedTasks = [];
    tasks.forEach((task, index) => {
      if(task.completed) {
        completedTasks.push(task);
      } else {
        openTasks.push(task);
      }
    })

    this.tasks = openTasks.concat(completedTasks);
    this.categorizedTasks = {openTasks: openTasks, completedTasks: completedTasks};

    return this.categorizedTasks;
  }

  moveTaskToTop(task) {
    this.tasks.splice(this.tasks.indexOf(task), 1);
    this.tasks.unshift(task);
  }

  changeTaskPosition(task, taskOccupyingTargetLocation) {
    let from = this.tasks.indexOf(task);
    let to = this.tasks.indexOf(taskOccupyingTargetLocation);

    this.tasks = this.tasks.move(from, to);
  }

  clearCompleted() {
    this.removeTasks(this.completedTasks());
    this.save();
  }

  deleteTask(task) {
    this.removeTasks([task]);
    this.save();
  }

  buildHtmlPreview() {
    var openTasks = this.categorizedTasks.openTasks;
    var completedTasks = this.categorizedTasks.completedTasks;
    var totalLength = openTasks.length + completedTasks.length;

    var taskPreviewLimit = 3;
    var tasksToPreview = Math.min(openTasks.length, taskPreviewLimit);

    var html = "<div>";
    html += `<div style="margin-top: 8px;"><strong>${completedTasks.length}/${totalLength} tasks completed</strong></div>`;
    html += `<progress max="100" style="margin-top: 10px; width: 100%;" value="${(completedTasks.length/totalLength) * 100}"></progress>`;

    if(tasksToPreview > 0) {
      html += "<ul style='padding-left: 19px; margin-top: 10px;'>";
      for(var i = 0; i < tasksToPreview; i++) {
        var task = openTasks[i];
        html += `<li style='margin-bottom: 6px;'>${task.content}</li>`
      }
      html += "</ul>";

      if(openTasks.length > tasksToPreview) {
        var diff = openTasks.length - tasksToPreview;
        var noun = diff == 1 ? "task" : "tasks";
        html += `<div><strong>And ${diff} other open ${noun}.</strong></div>`
      }
    }

    html += "</div>"

    return html;
  }

  buildPlainPreview() {
    var openTasks = this.categorizedTasks.openTasks;
    var completedTasks = this.categorizedTasks.completedTasks;
    var totalLength = openTasks.length + completedTasks.length;

    var taskPreviewLimit = 1;
    var tasksToPreview = Math.min(openTasks.length, taskPreviewLimit);

    var plain = "";
    plain += `${completedTasks.length}/${totalLength} tasks completed.`;

    return plain;
  }

  save() {
    this.dataString = this.tasks.map((task) => {
      return task.rawString
    }).join(TaskDelimitter);

    if(this.note) {
      // required to build dynamic previews
      this.splitTasks();
      this.note.content.text = this.dataString;
      this.note.content.preview_html = this.buildHtmlPreview();
      this.note.content.preview_plain = this.buildPlainPreview();
      this.componentManager.saveItem(this.note);
    }
  }

}

Array.prototype.move = function (old_index, new_index) {
    while (old_index < 0) {
        old_index += this.length;
    }
    while (new_index < 0) {
        new_index += this.length;
    }
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this; // for testing purposes
};

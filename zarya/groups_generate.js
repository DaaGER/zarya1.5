require('dotenv').config({path: '../.env'});
const fs = require('fs')

const volumesData = JSON.parse(fs.readFileSync('./volumes.json'));
const countInstances = parseInt(process.env.INSTANCES_COUNT);
const maxItemsInGroup = 120
console.log('Максимум элементов в группе:' + maxItemsInGroup)
let groups = Array.from(Array(countInstances), () => []);
let groupsSumValue = Array(countInstances).fill(0);

let excludeGroups = [];
for ([ticker, value] of Object.entries(volumesData)) {
    // Фильтруем уже заполненные группы и берем только те, у которых количество элементов меньше максимального.
    let availableGroupsSum = groupsSumValue.filter((value, index) => !excludeGroups.includes(index))
    // Если все группы заполнены, выводим сообщение об ошибке и завершаем выполнение скрипта с кодом ошибки.
    if (availableGroupsSum.length === 0) {
        console.error('ERROR: Недостаточно контейнеров для размещения всех элементов');
        const maxItemsCount = Math.ceil(Object.keys(volumesData).length / maxItemsInGroup);
        console.error('ERROR: Минимальное необходимое значение: ' + maxItemsCount);
        process.exit(1);
    }
    // Выбираем группу с минимальной суммой значений.
    let minSumIndex = groupsSumValue.indexOf(Math.min(...availableGroupsSum))
    // Добавляем элемент в выбранную группу и обновляем сумму значений.
    groups[minSumIndex].push(ticker)
    groupsSumValue[minSumIndex] += value;
    // Если группа достигла максимального размера, то исключаем ее из списка доступных групп.
    if (groups[minSumIndex].length === maxItemsInGroup) {
        excludeGroups.push(minSumIndex)
    }
}

// Выводим информацию о группах.
groups.forEach(function (group, index) {
    let sum = 0;
    let count = 0;
    for (let ticker of group) {
        sum += volumesData[ticker];
        count++;
    }
    console.log(`${index}) volume - ${sum}, count - ${count}` + (excludeGroups.includes(index) ? ' *' : ''));
})

// Сохраняем информацию о группах в файл.
fs.writeFileSync('./groups.json', JSON.stringify(groups))

// Выводим список исключенных групп.
console.log("\nКоличество заполненных контейнеров: " + excludeGroups.length)
